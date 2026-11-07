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
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = form.querySelector('.form-message');
      const isArabic = document.documentElement.lang === 'ar';
      message.textContent = isArabic
        ? 'شكراً لك! هذا نموذج تجريبي ولم يتم إرسال البيانات.'
        : 'Thank you! This is a demo form; no information has been sent.';
      form.reset();
    });
  }
})();