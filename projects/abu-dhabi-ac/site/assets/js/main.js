(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('is-open', !expanded);
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      });
    });
  }

  document.querySelectorAll('#year').forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  const form = document.querySelector('#request-form');
  if (!form) return;

  const config = window.RAHA_FORM_CONFIG || {};
  const message = form.querySelector('.form-message');
  const button = form.querySelector('button[type="submit"]');
  const language = document.documentElement.lang;
  const copy = {
    ar: {
      demo: 'شكراً لك! هذا نموذج تجريبي ولم يتم إرسال البيانات.',
      sent: 'شكراً لك! تم إرسال طلبك بنجاح.',
      error: 'تعذّر إرسال الطلب الآن. يرجى المحاولة لاحقاً.',
      captcha: 'يرجى إكمال التحقق الأمني أولاً.',
      button: 'إرسال الطلب',
      wait: 'جارٍ الإرسال...'
    },
    en: {
      demo: 'Thank you! This is a demo form; no information has been sent.',
      sent: 'Thank you! Your enquiry has been sent.',
      error: 'The enquiry could not be sent. Please try again later.',
      captcha: 'Please complete the security check first.',
      button: 'Send enquiry',
      wait: 'Sending...'
    },
    ru: {
      demo: 'Спасибо! Это демонстрационная форма, данные никуда не отправлены.',
      sent: 'Спасибо! Заявка успешно отправлена.',
      error: 'Не удалось отправить заявку. Попробуйте ещё раз позже.',
      captcha: 'Сначала пройдите проверку безопасности.',
      button: 'Отправить заявку',
      wait: 'Отправляем...'
    }
  }[language] || {
    demo: 'This is a demo form; no information has been sent.',
    sent: 'Your enquiry has been sent.',
    error: 'The enquiry could not be sent. Please try again later.',
    captcha: 'Please complete the security check first.',
    button: 'Send enquiry',
    wait: 'Sending...'
  };

  const active = config.enabled === true &&
    typeof config.endpoint === 'string' && config.endpoint.startsWith('https://') &&
    typeof config.turnstileSiteKey === 'string' &&
    !config.turnstileSiteKey.startsWith('REPLACE_');

  if (!active) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      message.textContent = copy.demo;
      form.reset();
    });
    return;
  }

  const captcha = form.querySelector('#turnstile-widget');
  const honeypot = form.querySelector('.form-honeypot');
  button.textContent = copy.button;

  let turnstileToken = '';
  let widgetId = null;
  let captchaReady = false;

  const renderCaptcha = () => {
    if (!window.turnstile || captchaReady) return;
    widgetId = window.turnstile.render(captcha, {
      sitekey: config.turnstileSiteKey,
      callback: (token) => { turnstileToken = token; },
      'expired-callback': () => { turnstileToken = ''; },
      'error-callback': () => { turnstileToken = ''; }
    });
    captchaReady = true;
  };

  if (!window.turnstile) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = renderCaptcha;
    document.head.appendChild(script);
  } else {
    renderCaptcha();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (honeypot.querySelector('input').value) {
      message.textContent = copy.sent;
      form.reset();
      return;
    }
    if (!turnstileToken) {
      message.textContent = copy.captcha;
      return;
    }

    const values = new FormData(form);
    const payload = {
      name: String(values.get('name') || '').trim(),
      phone: String(values.get('phone') || '').trim(),
      service: String(values.get('service') || '').trim(),
      message: String(values.get('message') || '').trim(),
      language,
      website: String(values.get('website') || ''),
      turnstileToken
    };

    button.disabled = true;
    button.textContent = copy.wait;
    message.textContent = '';
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'request_failed');
      message.textContent = copy.sent;
      form.reset();
      turnstileToken = '';
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    } catch (error) {
      message.textContent = copy.error;
    } finally {
      button.disabled = false;
      button.textContent = copy.button;
    }
  });
})();
