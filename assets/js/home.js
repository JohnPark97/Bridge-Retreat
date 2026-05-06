import { el, svg } from './dom.js';
import {
  findNextMainEvent, todaysEvents, classifyEvents,
  startCountdown, getNow,
} from './countdown.js';

const ICON_HOUSE    = ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'];
const ICON_SUNRISE  = [
  'M12 2v4', 'M12 18v4', 'M4.93 4.93l2.83 2.83', 'M16.24 16.24l2.83 2.83',
  'M2 12h4', 'M18 12h4', 'M4.93 19.07l2.83-2.83', 'M16.24 7.76l2.83-2.83',
];

const pad = n => String(n).padStart(2, '0');

export function renderHome(ctx) {
  const { session, theme, schedule } = ctx;
  const root = document.getElementById('home');
  root.replaceChildren();

  const hero = buildHero(session);
  const cd   = buildCountdown();
  const verse = buildVerse(theme);

  let todayEl = buildToday(classifyEvents(todaysEvents(schedule)));

  root.append(hero, cd.card, verse, todayEl);

  // Wire countdown
  const target = findNextMainEvent(schedule);
  if (!target) {
    cd.card.hidden = true;
  } else {
    cd.tName.textContent  = target.title;
    cd.tPlace.textContent = `${target._dayLabel || ''} · ${target.place || ''}`.replace(/^\s*·\s*/, '');
    cd.tTime.textContent  = target.time || '';

    startCountdown(target, ({ h, m, s, ready, started }) => {
      cd.hh.textContent = pad(h);
      cd.mm.textContent = pad(m);
      cd.ss.textContent = pad(s);
      cd.at.textContent = started
        ? '시작됨'
        : (h > 0 ? `in ${h}h ${m}m` : `in ${m}m`);
      cd.card.classList.toggle('ready', ready);
    });
  }

  // Re-classify schedule states each minute so past/now/upcoming flip as time passes.
  setInterval(() => {
    const fresh = buildToday(classifyEvents(todaysEvents(schedule)));
    todayEl.replaceWith(fresh);
    todayEl = fresh;
  }, 60 * 1000);
}

function buildHero(session) {
  return el('section', { class: 'hero reveal d2' },
    el('div', { class: 'greet' },
      el('span', { class: 'pip' }),
      '환영합니다',
    ),
    el('h1', {},
      '안녕, ',
      el('span', { class: 'gr', text: session.korean_name || '' }),
      ' 님!',
    ),
    el('div', { class: 'meta' },
      el('span', { class: 'chip accent' },
        svg('0 0 24 24', ICON_HOUSE, { strokeWidth: 2.5 }),
        ` ${session.room ?? ''}호`,
      ),
      session.floor ? el('span', { class: 'chip', text: `${session.floor}층` }) : null,
      session.cell_name ? el('span', { class: 'chip', text: session.cell_name }) : null,
    ),
  );
}

function buildCountdown() {
  const live = el('span', { class: 'live' });
  const lbl  = el('span', { class: 'lbl' }, live, '다음 일정');
  const at   = el('span', { class: 'at' });

  const hh = el('span', { text: '00' });
  const mm = el('span', { text: '00' });
  const ss = el('span', { text: '00' });
  const digits = el('div', { class: 'digits' },
    hh, el('span', { class: 'colon', text: ':' }),
    mm, el('span', { class: 'colon', text: ':' }),
    ss,
  );

  const tName  = el('div', { class: 'name' });
  const tPlace = el('div', { class: 'place' });
  const tTime  = el('div', { class: 'time' });
  const target = el('div', { class: 'target' },
    el('div', { class: 'icon' }, svg('0 0 24 24', ICON_SUNRISE, { strokeWidth: 2.5 })),
    el('div', { class: 'info' }, tName, tPlace),
    tTime,
  );

  const card = el('section', { class: 'countdown reveal d3' },
    el('div', { class: 'head' }, lbl, at),
    digits,
    target,
  );
  return { card, hh, mm, ss, at, tName, tPlace, tTime };
}

function buildVerse(theme) {
  const v = theme?.verse || {};
  const text = String(v.text_ko || '');
  const emphasis = String(v.emphasis || '');

  const blockquote = el('blockquote');
  if (emphasis && text.includes(emphasis)) {
    const i = text.indexOf(emphasis);
    blockquote.append(text.slice(0, i));
    blockquote.append(el('span', { class: 'em', text: emphasis }));
    blockquote.append(text.slice(i + emphasis.length));
  } else {
    blockquote.textContent = text;
  }

  return el('section', { class: 'verse reveal d4' },
    el('div', { class: 'lbl', text: `2026 Theme · ${v.reference_ko || ''}` }),
    blockquote,
    el('cite', {},
      el('span', { text: v.reference_ko || '' }),
      el('span', { class: 'en', text: v.text_en || '' }),
    ),
  );
}

function buildToday(events) {
  const head = el('div', { class: 'head' },
    el('span', { class: 'title', text: '오늘의 일정' }),
    el('span', { class: 'meta', text: events.length ? `${events.length} EVENTS` : '' }),
  );

  if (events.length === 0) {
    return el('section', { class: 'schedule reveal d5' },
      head,
      el('div', { style: 'padding:32px 16px;text-align:center;color:var(--ink-3);font-size:14px;' },
        '오늘 일정이 없어요.'),
    );
  }

  const rows = events.map(ev => {
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
  });

  return el('section', { class: 'schedule reveal d5' }, head, ...rows);
}
