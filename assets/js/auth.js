import { CONFIG } from './config.js';
import { CACHE_PREFIX } from './data.js';

export function getSession() {
  try {
    const raw = localStorage.getItem(CONFIG.SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expires_at) {
      localStorage.removeItem(CONFIG.SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSession(person) {
  const session = {
    id:            person.id,
    korean_name:   person.korean_name,
    room:          person.room,
    floor:         person.floor,
    cell_name:     person.cell_name,
    is_leader:     person.is_leader,
    checked_in_at: person.checked_in_at,
    expires_at:    Date.now() + CONFIG.SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
  return session;
}

export function patchSession(patch) {
  const current = getSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearSession() {
  localStorage.removeItem(CONFIG.SESSION_KEY);
  // Clear cached data so the next user on this device doesn't see stale roster.
  // Iterate over a static key list (Object.keys snapshot) — removeItem mutates.
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
  }
}

// Match a person by Korean name + birth month + birth day
export function findMatch(roster, name, month, day) {
  const trimmed = (name || '').trim();
  const m = Number(month);
  const d = Number(day);
  if (!trimmed || !m || !d) return null;
  return roster.find(p =>
    p.korean_name === trimmed &&
    p.birthday &&
    p.birthday.month === m &&
    p.birthday.day === d
  ) || null;
}
