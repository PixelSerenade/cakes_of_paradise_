(() => {
  const defaults = { theme: 'light', accent: 'sage', textSize: 'standard', readableFont: false, highContrast: false, reduceMotion: false, grayscale: false };
  const allowed = {
    theme: ['light', 'dark', 'system'],
    accent: ['sage', 'blush', 'butter', 'sky', 'lilac'],
    textSize: ['small', 'standard', 'large', 'largest'],
  };
  const read = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('cakeUiPreferences') || '{}');
      return {
        theme: allowed.theme.includes(saved.theme) ? saved.theme : defaults.theme,
        accent: allowed.accent.includes(saved.accent) ? saved.accent : defaults.accent,
        textSize: allowed.textSize.includes(saved.textSize) ? saved.textSize : defaults.textSize,
        readableFont: saved.readableFont === true,
        highContrast: saved.highContrast === true,
        reduceMotion: saved.reduceMotion === true,
        grayscale: saved.grayscale === true,
      };
    } catch { return { ...defaults }; }
  };
  const apply = (preferences) => {
    const root = document.documentElement;
    const theme = preferences.theme === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : preferences.theme;
    root.dataset.theme = theme;
    root.dataset.accent = preferences.accent;
    root.dataset.textSize = preferences.textSize;
    root.dataset.readableFont = String(preferences.readableFont);
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.reduceMotion = String(preferences.reduceMotion);
    root.dataset.grayscale = String(preferences.grayscale);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'dark' ? '#1e1916' : '#fff8f5';
  };
  const save = (updated) => {
    const current = read();
    const merged = { ...current, ...updated };
    try { localStorage.setItem('cakeUiPreferences', JSON.stringify(merged)); } catch {}
    apply(merged);
    return merged;
  };
  const toggleGrayscale = () => {
    const current = read();
    return save({ grayscale: !current.grayscale });
  };
  const toggleHighContrast = () => {
    const current = read();
    return save({ highContrast: !current.highContrast });
  };
  window.CakePreferences = { read, apply, save, toggleGrayscale, toggleHighContrast };
  const current = read();
  apply(current);
  if (window.matchMedia) {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      const latest = read();
      if (latest.theme === 'system') apply(latest);
    };
    if (colorScheme.addEventListener) colorScheme.addEventListener('change', updateSystemTheme);
    else colorScheme.addListener?.(updateSystemTheme);
  }
  window.addEventListener('storage', (event) => {
    if (event.key === 'cakeUiPreferences' || event.key === null) apply(read());
  });
})();
