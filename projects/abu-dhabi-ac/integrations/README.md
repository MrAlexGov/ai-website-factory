# Raha Cooling — protected form setup

The demo form remains in demo mode until the external credentials below are configured.
No real Google account or spreadsheet credentials are stored in this repository.

## Architecture

Browser -> Cloudflare Turnstile -> Cloudflare Worker -> Google Apps Script -> private Google Sheet.

The browser only receives the Turnstile **site key** and Worker URL. The Turnstile secret,
Apps Script URL and shared secret are Worker secrets. The spreadsheet ID and matching
shared secret live in Apps Script Script Properties. The spreadsheet itself stays private.

## 1. Create the private Google Sheet

1. Create a spreadsheet in the Google account that should own the leads.
2. Name the first tab `Заявки` (the script creates it if missing).
3. Copy the spreadsheet ID from its URL (between `/d/` and `/edit`).

## 2. Install Google Apps Script

1. Open Extensions -> Apps Script from that spreadsheet.
2. Replace the editor contents with `google-apps-script/Code.gs` from this folder.
3. In Project Settings -> Script properties add:
   - `SPREADSHEET_ID`: the spreadsheet ID.
   - `SHARED_SECRET`: a long random value (at least 32 random bytes).
4. Deploy -> New deployment -> Web app:
   - Execute as: **Me**.
   - Who has access: **Anyone**.
5. Copy the Web app URL. Do not publish it in the site repository.

The spreadsheet remains private. The web app exposes only an append operation and checks
the shared secret before writing. Never add a read/list endpoint.

## 3. Configure Cloudflare

1. Create a Turnstile widget for hostname `mralexgov.github.io` and copy its site key
   and secret key.
2. Create a Cloudflare Worker using `cloudflare-worker/src/index.js`.
3. Create a KV namespace and bind it as `RATE_LIMITS`; set its ID in `wrangler.toml`.
4. Set `ALLOWED_ORIGIN` to the exact origin hosting the site, without a path.
5. Add Worker secrets (never commit these values):
   - `TURNSTILE_SECRET_KEY`
   - `APPS_SCRIPT_URL`
   - `APPS_SCRIPT_SHARED_SECRET` (same value as Apps Script `SHARED_SECRET`)
6. Deploy the Worker and copy its HTTPS URL.

KV rate limiting is best-effort (up to 5 submissions per IP per 10-minute bucket).
Turnstile verification and the honeypot are separate layers; neither is a guarantee against
all abuse. Monitor Worker logs and adjust thresholds if needed.

## 4. Enable the form on the site

Edit `projects/abu-dhabi-ac/site/assets/js/form-config.js`:
- Set `enabled: true`.
- Set `turnstileSiteKey` to the public Turnstile site key.
- Set `endpoint` to the deployed Worker HTTPS URL.

The same config is used by Arabic, English and Russian pages. The demo fallback remains active
while `enabled` is false or either public setting is missing.

## Security notes

- Do not make the spreadsheet public or share it with "Anyone with the link".
- Do not put Turnstile secret, Apps Script URL, shared secret, Google credentials or tokens
  in HTML, JavaScript, GitHub commits or public configuration.
- The Worker checks the exact origin, Turnstile result and hostname, validates field sizes,
  rejects the honeypot, and applies a per-IP KV limit.
- Apps Script validates the shared secret, uses a script lock while appending and protects
  cells from formula injection.
- For a production service with higher traffic or stronger abuse resistance, replace KV's
  approximate counter with a Durable Object or Cloudflare rate-limiting rule and add monitoring.
