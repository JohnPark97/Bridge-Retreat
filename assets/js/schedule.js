import { el } from './dom.js';
import {
  classifyEvents, eventStartTime, dateKey, getNow,
} from './countdown.js';

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function renderSchedule(ctx) {
  const { schedule } = ctx;
  const root = document.getElementById('schedule');
  root.replaceChildren();

  if (!schedule?.days?.length) {
    root.append(el('div', {
      style: 'padding:48px 16px;text-align:center;color:var(--ink-3);',
      text: '일정이 없습니다.',
    }));
    return;
  }

  const todayKey = dateKey(new Date(getNow()));

  schedule.days.forEach((day, i) => {
    const dKey = dateKey(day.date);
    const isToday = dKey === todayKey;

    let events = (day.events || []).map(ev => ({
      ...ev,
      _start: eventStartTime(day.date, ev.time),
    }));

    if (isToday) {
      events = classifyEvents(events);
    } else if (dKey < todayKey) {
      events = events.map(e => ({ ...e, _state: 'past' }));
    } else {
      events = events.map(e => ({ ...e, _state: 'upcoming' }));
    }

    const heading = el('h2', { class: 'day-heading' },
      day.label || '',
      el('span', { class: 'date', text: formatDate(dKey) }),
    );

    const card = el('section', { class: 'schedule' },
      ...events.map(buildEventRow),
    );

    const sectionClass = `day-section reveal d${Math.min(i + 2, 5)}` + (isToday ? ' today' : '');
    root.append(el('div', { class: sectionClass }, heading, card));
  });
}

function buildEventRow(ev) {
  const titleNode = el('span', { class: 'title' });
  if (ev._state === 'now') {
    titleNode.append(el('span', { class: 'live' }), ev.title);
  } else {
    titleNode.textContent = ev.title;
  }
  return el('div', { class: `ev ${ev._state}`.trim() },
    el('span', { class: 'time', text: ev.time }),
    titleNode,
    el('span', { class: 'place', text: ev.place || '' }),
  );
}

function formatDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}월 ${d}일 · ${KO_DAYS[date.getDay()]}요일`;
}
