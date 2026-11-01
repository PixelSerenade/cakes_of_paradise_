(() => {
  const form = document.getElementById('preferencesForm');
  const message = document.getElementById('settingsMessage');
  const fields = form.elements;
  const render = (preferences) => {
    fields.theme.value = preferences.theme;
    fields.accent.value = preferences.accent;
    fields.textSize.value = preferences.textSize;
    fields.readableFont.checked = preferences.readableFont;
    fields.highContrast.checked = preferences.highContrast;
    fields.grayscale.checked = Boolean(preferences.grayscale);
    fields.reduceMotion.checked = preferences.reduceMotion;
  };
  const currentFormPreferences = () => ({
    theme: fields.theme.value,
    accent: fields.accent.value,
    textSize: fields.textSize.value,
    readableFont: fields.readableFont.checked,
    highContrast: fields.highContrast.checked,
    grayscale: fields.grayscale.checked,
    reduceMotion: fields.reduceMotion.checked,
  });
  const save = (preferences) => {
    try {
      localStorage.setItem('cakeUiPreferences', JSON.stringify(preferences));
      window.CakePreferences.apply(preferences);
      return true;
    } catch {
      message.textContent = 'Your browser could not save these settings. Check that site storage is enabled.';
      message.classList.add('is-error');
      return false;
    }
  };
  render(window.CakePreferences.read());
  let isAdmin = false;
  try { isAdmin = JSON.parse(localStorage.getItem('user') || 'null')?.role === 'admin'; } catch { /* use customer navigation when the saved profile is invalid */ }
  document.querySelectorAll('[data-customer-nav]').forEach((link) => { link.hidden = isAdmin; });
  document.querySelectorAll('[data-admin-nav]').forEach((link) => { link.hidden = !isAdmin; });
  try {
    const cart = JSON.parse(localStorage.getItem('cakeBasket') || '[]');
    const cartCount = document.getElementById('settingsCartCount');
    if (cartCount) cartCount.textContent = String(Array.isArray(cart) ? cart.reduce((sum, line) => sum + (Number(line?.quantity) || 0), 0) : 0);
  } catch { const cartCount = document.getElementById('settingsCartCount'); if (cartCount) cartCount.textContent = '0'; }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (save(currentFormPreferences())) {
      message.classList.remove('is-error');
      message.textContent = 'Your preferences have been saved and applied across the site.';
    }
  });
  form.addEventListener('change', () => {
    if (save(currentFormPreferences())) {
      message.classList.remove('is-error');
      message.textContent = 'Preference applied and saved on this device.';
    }
  });
  document.getElementById('resetPreferences').addEventListener('click', () => {
    const defaults = { theme: 'light', accent: 'sage', textSize: 'standard', readableFont: false, highContrast: false, reduceMotion: false, grayscale: false };
    render(defaults);
    if (save(defaults)) {
      message.classList.remove('is-error');
      message.textContent = 'Accessibility and appearance settings reset to defaults.';
    }
  });
  document.getElementById('settingsSignOut').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('index.html#home');
  });
})();
