import { CONFIG } from './config.js';

const yamlMod = import('https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm');
const papaMod = import('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm');

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

export async function loadTheme() {
  return loadYaml('data/theme.yml');
}

export async function loadSchedule() {
  return loadYaml('data/schedule.yml');
}

export async function loadRoster() {
  const rows = devMode()
    ? await loadSampleCsv('data/sample-roster.csv')
    : await loadFromAppsScript('read_roster');

  return rows.map(row => ({
    id:            Number(row.id),
    korean_name:   String(row.korean_name || '').trim(),
    birthday:      parseBirthday(row.birthday),
    room:          String(row.room ?? '').trim(),
    floor:         String(row.floor ?? '').trim(),
    cell_name:     String(row.cell_name || '').trim(),
    is_leader:     String(row.is_leader).toUpperCase() === 'TRUE',
    checked_in_at: String(row.checked_in_at || '').trim() || null,
  }));
}

export async function loadCells() {
  const rows = devMode()
    ? await loadSampleCsv('data/sample-cells.csv')
    : await loadFromAppsScript('read_cells');

  return rows.map(row => ({
    cell_name:    String(row.cell_name || '').trim(),
    meeting_room: String(row.meeting_room || '').trim(),
  }));
}

// "12/29/1981" → { month: 12, day: 29, year: 1981 }
export function parseBirthday(s) {
  if (!s) return null;
  const [m, d, y] = String(s).split('/').map(Number);
  if (!m || !d) return null;
  return { month: m, day: d, year: y };
}
