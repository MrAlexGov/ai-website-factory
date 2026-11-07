/**
 * Cloudflare Worker: public form endpoint for Raha Cooling.
 *
 * Required Worker secrets:
 *   TURNSTILE_SECRET_KEY
 *   APPS_SCRIPT_URL
 *   APPS_SCRIPT_SHARED_SECRET
 * Required binding:
 *   RATE_LIMITS (Workers KV namespace)
 * Environment variable:
 *   ALLOWED_ORIGIN (e.g. https://mralexgov.github.io)
 */
const json = (body, status = 200, origin = "*") => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store"
  }
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "";
    if (request.method === "OPTIONS") {
      if (origin !== allowedOrigin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": allowedOrigin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          "vary": "Origin"
        }
      });
    }
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, allowedOrigin || "*");
    if (!allowedOrigin || origin !== allowedOrigin) return json({ ok: false, error: "origin_not_allowed" }, 403, allowedOrigin || "*");

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400, allowedOrigin);
    }

    // Honeypot: silently accept bot submissions without forwarding them.
    if (String(data.website || "").trim()) return json({ ok: true }, 200, allowedOrigin);

    const name = String(data.name || "").trim();
    const phone = String(data.phone || "").trim();
    const service = String(data.service || "").trim();
    const message = String(data.message || "").trim();
    const token = String(data.turnstileToken || "");
    if (!name || name.length > 100 || !phone || phone.length > 40 ||
        !service || service.length > 120 || message.length > 1500 || !token) {
      return json({ ok: false, error: "invalid_fields" }, 400, allowedOrigin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const bucket = Math.floor(Date.now() / 600000);
    const rateKey = `lead:${ip}:${bucket}`;
    const count = Number(await env.RATE_LIMITS.get(rateKey) || "0");
    if (count >= 5) return json({ ok: false, error: "rate_limited" }, 429, allowedOrigin);
    await env.RATE_LIMITS.put(rateKey, String(count + 1), { expirationTtl: 1200 });

    const verifyBody = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip
    });
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: verifyBody
    });
    const verification = await verifyResponse.json();
    if (!verification.success || verification.hostname !== new URL(allowedOrigin).hostname) {
      return json({ ok: false, error: "captcha_failed" }, 403, allowedOrigin);
    }

    const upstream = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: env.APPS_SCRIPT_SHARED_SECRET,
        lead: { name, phone, service, message, language: String(data.language || "unknown").slice(0, 8) }
      })
    });
    if (!upstream.ok) return json({ ok: false, error: "storage_unavailable" }, 502, allowedOrigin);
    let stored;
    try { stored = await upstream.json(); } catch { stored = null; }
    if (!stored || stored.ok !== true) return json({ ok: false, error: "storage_rejected" }, 502, allowedOrigin);
    return json({ ok: true }, 200, allowedOrigin);
  }
};
