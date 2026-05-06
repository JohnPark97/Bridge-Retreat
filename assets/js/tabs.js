const VALID = new Set(['home', 'schedule', 'group']);
const DEFAULT = 'home';

export function initTabs() {
  const buttons = document.querySelectorAll('.tabbar .tab');
  const panels  = document.querySelectorAll('.tab-panel');

  function show(tab) {
    if (!VALID.has(tab)) tab = DEFAULT;
    panels.forEach(p => { p.hidden = (p.id !== tab); });
    buttons.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    
    // Topbar transparency logic for Home layout
    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.classList.toggle('transparent', tab === 'home');

    if (location.hash !== '#' + tab) {
      history.replaceState(null, '', '#' + tab);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  buttons.forEach(b => {
    b.addEventListener('click', () => show(b.dataset.tab));
  });

  window.addEventListener('hashchange', () => {
    const tab = location.hash.replace(/^#/, '') || DEFAULT;
    show(tab);
  });
  
  // Listen for programmatic tab changes (from Action Bar)
  document.addEventListener('nav-tab', (e) => {
    show(e.detail);
  });

  const initial = location.hash.replace(/^#/, '') || DEFAULT;
  show(initial);
}
