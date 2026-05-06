import { getSession } from './auth.js';
import { loadTheme, loadSchedule, loadRoster, loadCells } from './data.js';
import { initTabs } from './tabs.js';
import { getNow } from './countdown.js';
import { maybeShowCheckin } from './checkin.js';

const session = getSession();
if (!session) {
  location.replace('index.html');
} else {
  bootstrap();
}

async function bootstrap() {
  // Load each independently — a missing piece shouldn't kill the whole app.
  const results = await Promise.allSettled([
    loadTheme(), loadSchedule(), loadRoster(), loadCells(),
  ]);
  const [tR, sR, rR, cR] = results;
  if (tR.status === 'rejected') console.warn('theme failed', tR.reason);
  if (sR.status === 'rejected') console.warn('schedule failed', sR.reason);
  if (rR.status === 'rejected') console.warn('roster failed', rR.reason);
  if (cR.status === 'rejected') console.warn('cells failed', cR.reason);

  const theme    = tR.status === 'fulfilled' ? tR.value : null;
  const schedule = sR.status === 'fulfilled' ? sR.value : null;
  const roster   = rR.status === 'fulfilled' ? rR.value : [];
  const cells    = cR.status === 'fulfilled' ? cR.value : [];

  const ctx = { session, theme, schedule, roster, cells };

  // Lazy-import each tab with cache busting so updates show immediately
  const v = Date.now();
  try { (await import(`./home.js?v=${v}`)).renderHome(ctx); }         catch (e) { console.error('home', e); }
  try { (await import(`./schedule.js?v=${v}`)).renderSchedule(ctx); } catch (e) { console.error('schedule', e); }
  try { (await import(`./group.js?v=${v}`)).renderGroup(ctx); }       catch (e) { console.error('group', e); }

  // Hide splash screen smoothly
  const splash = document.getElementById('splash');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    setTimeout(() => splash.remove(), 600);
  }

  initTabs();
  maybeShowCheckin(session);
}

function pad(n) { return String(n).padStart(2, '0'); }
function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
