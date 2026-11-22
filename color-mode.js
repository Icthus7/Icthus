// La apariencia del panel se guarda aparte de los fondos y estilos de proyección.
(() => {
  const key = 'icthus-color-mode-v1';
  const root = document.documentElement;
  const readMode = () => {
    try { return localStorage.getItem(key) === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  };
  let mode = readMode();
  function applyMode(next) {
    mode = next;
    root.dataset.colorMode = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#f5f6fb' : '#101118');
    const button = document.getElementById('colorModeToggle');
    if (!button) return;
    const label = mode === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.querySelector('span').textContent = mode === 'dark' ? 'Modo claro' : 'Modo oscuro';
    button.querySelector('use').setAttribute('href', './icons.svg#' + (mode === 'dark' ? 'sun' : 'moon'));
  }
  applyMode(mode);
  function connectControl() {
    const button = document.getElementById('colorModeToggle');
    if (!button) return;
    applyMode(mode);
    button.addEventListener('click', () => {
      applyMode(mode === 'dark' ? 'light' : 'dark');
      document.getElementById('colorModeStatus').textContent = mode === 'light' ? 'Modo claro activado.' : 'Modo oscuro activado.';
      try { localStorage.setItem(key, mode); }
      catch {
        document.getElementById('colorModeStatus').textContent = 'Modo aplicado. El navegador no pudo guardar esta preferencia.';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connectControl, { once: true });
  else connectControl();
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) applyMode(readMode());
  });
})();
