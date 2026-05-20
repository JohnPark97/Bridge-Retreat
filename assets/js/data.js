import { CONFIG } from './config.js';

const yamlMod = import('https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm');
const papaMod = import('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm');

export const CACHE_PREFIX = 'br_cache_';

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return res.text();
}

async function loadYaml(path) {
  const yaml = (await yamlMod).default;
  return yaml.load(await fetchText(path));
}

// In dev mode (Apps Script not configured), parse the bundled sample CSV instead.
async function loadSampleCsv(path) {
  const Papa = (await papaMod).default;
  const text = await fetchText(path);
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  return data;
}

// Real-mode reads go through the Apps Script POST proxy with the SECRET.
async function loadFromAppsScript(action) {
  const url    = CONFIG.APPS_SCRIPT_URL;
  const secret = CONFIG.APPS_SCRIPT_SECRET;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret, action }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${action}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`${action}: ${data.err || 'unknown'}`);
  return data.rows || [];
}

function devMode() {
  return isPlaceholder(CONFIG.APPS_SCRIPT_URL) || isPlaceholder(CONFIG.APPS_SCRIPT_SECRET);
}
function isPlaceholder(s) {
  return !s || /^PASTE_/.test(s) || /^CHANGE_ME/.test(s);
}

/**
 * Stale-while-revalidate cache, backed by localStorage.
 *
 * - Cache hit  → returns cached data instantly; refreshes in the background.
 * - Cache miss → fetches fresh, writes cache, returns. Throws on failure.
 * - Corrupt/garbage cache → treated as a miss (forces a fresh fetch).
 * - Background refresh failures are swallowed (cached data is still good).
 *
 * Live mode only — dev mode reads sample data straight through so devs see
 * file edits immediately.
 */
async function withSWR(key, fetcher) {
  let cached = null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data !== undefined) cached = parsed;
    }
  } catch {
    // Corrupt JSON in cache slot — fall through to a fresh fetch.
  }

  if (cached) {
    fetcher()
      .then(data => writeCache(key, data))
      .catch(() => { /* keep cache on background failure */ });
    return cached.data;
  }

  // No cache — must wait for network.
  const data = await fetcher();
  writeCache(key, data);
  return data;
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Quota exceeded or storage disabled — silent. App still functions, just no cache.
  }
}

function maybeCached(key, fetcher) {
  return devMode() ? fetcher() : withSWR(key, fetcher);
}

export function clearDataCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable — fresh fetches still work, just no cache to clear.
  }
}

const mapRoster = rows => rows.map(row => ({
  id:            Number(row.id),
  korean_name:   String(row.korean_name || '').trim(),
  birthday:      parseBirthday(row.birthday),
  room:          String(row.room ?? '').trim(),
  floor:         String(row.floor ?? '').trim(),
  cell_name:     String(row.cell_name || '').trim(),
  is_leader:     String(row.is_leader).toUpperCase() === 'TRUE',
  checked_in_at: String(row.checked_in_at || '').trim() || null,
}));

const mapCells = rows => rows.map(row => ({
  cell_name:    String(row.cell_name || '').trim(),
  meeting_room: String(row.meeting_room || '').trim(),
}));

export async function loadTheme() {
  return maybeCached('theme', () => loadYaml('data/theme.yml'));
}

export async function loadSchedule() {
  return maybeCached('schedule', () => loadYaml('data/schedule.yml'));
}

export async function loadRoster(options = {}) {
  if (devMode()) return mapRoster(await loadSampleCsv('data/sample-roster.csv'));
  if (options.fresh) return mapRoster(await loadFromAppsScript('read_roster'));
  return withSWR('roster', async () => mapRoster(await loadFromAppsScript('read_roster')));
}

export async function loadCells(options = {}) {
  if (devMode()) return mapCells(await loadSampleCsv('data/sample-cells.csv'));
  if (options.fresh) return mapCells(await loadFromAppsScript('read_cells'));
  return withSWR('cells', async () => mapCells(await loadFromAppsScript('read_cells')));
}

// "12/29/1981" → { month: 12, day: 29, year: 1981 }
export function parseBirthday(s) {
  if (!s) return null;
  const [m, d, y] = String(s).split('/').map(Number);
  if (!m || !d) return null;
  return { month: m, day: d, year: y };
}
