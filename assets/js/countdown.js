// Schedule time logic: flatten events, find current/next, tick countdown.

const HOUR_MS = 60 * 60 * 1000;
const NOW_WINDOW_MS = 2 * HOUR_MS;

// QA helper — pass ?now=2026-05-30T17:13 in URL to fake the clock for testing.
export function getNow() {
  const p = new URLSearchParams(location.search).get('now');
  if (p) {
    const t = Date.parse(p);
    if (!isNaN(t)) return t;
  }
  return Date.now();
}

export function flattenEvents(schedule) {
  if (!schedule?.days) return [];
  const out = [];
  for (const day of schedule.days) {
    if (!day.events) continue;
    for (const ev of day.events) {
      out.push({
        ...ev,
        _start:    eventStartTime(day.date, ev.time),
        _dayDate:  day.date,
        _dayLabel: day.label,
      });
    }
  }
  return out.sort((a, b) => a._start - b._start);
}

export function findNextMainEvent(schedule, now = getNow()) {
  const future = flattenEvents(schedule).filter(ev => ev._start > now);
  return future.find(ev => ev.is_main) || future[0] || null;
}

export function todaysEvents(schedule, now = getNow()) {
  if (!schedule?.days) return [];
  const key = dateKey(new Date(now));
  const day = schedule.days.find(d => dateKey(d.date) === key);
  if (!day) return [];
  return day.events.map(ev => ({
    ...ev,
    _start: eventStartTime(day.date, ev.time),
  }));
}

// Given an array of events on the same day, mark each as past / now / upcoming.
// "now" = the most recent event whose start <= now AND start > (now - 2h).
export function classifyEvents(events, now = getNow()) {
  let nowIdx = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const start = events[i]._start;
    if (start <= now && (now - start) < NOW_WINDOW_MS) {
      nowIdx = i;
      break;
    }
  }
  return events.map((ev, i) => {
    let _state;
    if (i === nowIdx) _state = 'now';
    else if (ev._start < now) _state = 'past';
    else _state = 'upcoming';
    return { ...ev, _state };
  });
}

// Tick once per second. `render({ h, m, s, ready, started })` is called each tick.
// Returns a stop() function.
export function startCountdown(target, render) {
  if (!target) {
    render({ h: 0, m: 0, s: 0, ready: false, started: true });
    return () => {};
  }
  const update = () => {
    const diff = target._start - getNow();
    if (diff <= 0) {
      render({ h: 0, m: 0, s: 0, ready: false, started: true });
      return false;
    }
    const sec = Math.floor(diff / 1000);
    render({
      h: Math.floor(sec / 3600),
      m: Math.floor((sec % 3600) / 60),
      s: sec % 60,
      ready: diff <= HOUR_MS,
      started: false,
    });
    return true;
  };
  update();
  const id = setInterval(() => { if (!update()) clearInterval(id); }, 1000);
  return () => clearInterval(id);
}

export function eventStartTime(dayDate, timeStr) {
  const [yyyy, mm, dd] = dateKey(dayDate).split('-').map(Number);
  const [h, mins] = String(timeStr).split(':').map(Number);
  return new Date(yyyy, mm - 1, dd, h, mins, 0, 0).getTime();
}

// Normalize a date (Date object or "YYYY-MM-DD" string) to "YYYY-MM-DD".
export function dateKey(d) {
  if (d instanceof Date) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  }
  return String(d).slice(0, 10);
}

export function pad(n) { return String(n).padStart(2, '0'); }
