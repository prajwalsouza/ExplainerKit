// Theme is restored before first paint; the rest enhances the readable HTML.
const root = document.documentElement, KEY = 'explainerkit-docs-theme';
try { if (localStorage.getItem(KEY) === 'dark') root.classList.add('dark'); } catch { /* light default */ }
addEventListener('DOMContentLoaded', () => {
  const themed = new Set(), disposers = new Set();
  document.querySelector('.theme')?.addEventListener('click', () => {
    root.classList.toggle('dark');
    try { localStorage.setItem(KEY, root.classList.contains('dark') ? 'dark' : 'light'); } catch { /* optional persistence */ }
    for (const fn of themed) fn(root.classList.contains('dark'));
  });
  const panel = document.querySelector('.nav-panel');
  const mobile = matchMedia('(max-width: 760px)');
  const fitNavigation = () => { if (panel) panel.open = !mobile.matches; };
  fitNavigation();mobile.addEventListener('change', fitNavigation);
  const sidebar = document.querySelector('.sidebar');
  const fadeNavigation = () => {
    if (!sidebar) return;
    sidebar.style.setProperty('--fade-top', sidebar.scrollTop > 2 ? '24px' : '0px');
    sidebar.style.setProperty('--fade-bottom', sidebar.scrollHeight - sidebar.clientHeight - sidebar.scrollTop > 2 ? '28px' : '0px');
  };
  sidebar?.addEventListener('scroll', fadeNavigation, {passive: true});
  const navResize = new ResizeObserver(fadeNavigation);
  if (sidebar) navResize.observe(sidebar);
  panel?.addEventListener('toggle', fadeNavigation);
  fadeNavigation();
  const currentPage = sidebar?.querySelector('[aria-current="page"]');
  if (currentPage && !mobile.matches) {
    const box = currentPage.getBoundingClientRect(), viewport = sidebar.getBoundingClientRect();
    if (box.bottom > viewport.bottom - 28 || box.top < viewport.top + 24) {
      sidebar.scrollTop += box.top - viewport.top - sidebar.clientHeight * .4;
      fadeNavigation();
    }
  }

  panel?.addEventListener('click', (event) => { if (mobile.matches && event.target.closest('a')) panel.open = false; });

  const status = document.createElement('div');
  status.className = 'copy-status';status.setAttribute('role', 'status');document.body.append(status);
  let statusTimer;
  const copy = async (text, control) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const field = document.createElement('textarea');field.value = text;field.style.position = 'fixed';field.style.opacity = '0';document.body.append(field);field.select();
        const success = document.execCommand('copy');field.remove();control.focus();
        if (!success) throw Error('Clipboard unavailable');
      }
      status.textContent = 'Copied';
      if (control.classList.contains('copy-block')) control.textContent = 'Copied';
    } catch { status.textContent = 'Copy unavailable. Select the text to copy it.'; }
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status.textContent = '';
      document.querySelectorAll('.copy-block').forEach((button) => { button.textContent = 'Copy'; });
    }, 1800);
  };
  document.querySelectorAll('pre > code').forEach((code) => {
    const button = document.createElement('button');button.type = 'button';button.className = 'copy-block';button.textContent = 'Copy';button.setAttribute('aria-label', 'Copy code example');
    button.addEventListener('click', () => void copy(code.textContent, button));code.parentElement.prepend(button);
  });
  document.querySelectorAll('.doc code, .import-line code').forEach((code) => {
    if (code.closest('a, pre, button')) return;
    code.classList.add('copy-inline');code.tabIndex = 0;code.setAttribute('role', 'button');code.setAttribute('aria-label', `Copy ${code.textContent}`);code.title = 'Click to copy';
    code.addEventListener('click', () => void copy(code.textContent, code));
    code.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault();void copy(code.textContent, code); } });
  });

  const base = document.querySelector('meta[name="docs-root"]')?.content ?? './';
  let disposed = false;
  const context = () => ({
    hue: Number(getComputedStyle(document.body).getPropertyValue('--h')) || 214,
    dark: () => root.classList.contains('dark'),
    onTheme: (fn) => { themed.add(fn);return () => themed.delete(fn); },
    still: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  const mount = async (figure) => {
    const stage = figure.querySelector('.stage');
    figure.classList.add('loading');
    stage.setAttribute('aria-busy', 'true');
    try {
      const module = await import(new URL(`demos/${figure.dataset.demo}.js`, new URL(base, location.href)).href);
      if (disposed) return;
      const dispose = await module.default(stage, context());
      if (typeof dispose === 'function') { if (disposed) dispose();else disposers.add(dispose); }
      figure.classList.add('ready');
    } catch {
      figure.classList.add('failed');
      if (!stage.querySelector('.ds')) stage.textContent = 'The interactive example is unavailable. Reload the page to try again.';
    } finally {
      stage.removeAttribute('aria-busy');
      figure.classList.remove('loading');
    }
  };
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) { near.unobserve(entry.target);void mount(entry.target); }
  }, {rootMargin: '200px 0px'});
  document.querySelectorAll('figure.demo').forEach((figure) => {
    // Incoming beat links may target a form inside closed fallback details.
    if (figure.dataset.demo === 'design-story') void mount(figure);
    else near.observe(figure);
  });
  addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    disposed = true;near.disconnect();navResize.disconnect();clearTimeout(statusTimer);mobile.removeEventListener('change', fitNavigation);
    for (const dispose of disposers) dispose();
    disposers.clear();themed.clear();
  });
});
