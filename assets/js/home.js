import { el, svg } from './dom.js';
import {
  findNextMainEvent, todaysEvents, classifyEvents, getNow,
} from './countdown.js';

const pad = n => String(n).padStart(2, '0');

export function renderHome(ctx) {
  const { session, theme, schedule } = ctx;
  const root = document.getElementById('home');
  root.replaceChildren();

  // 1. Build Static Layouts
  const hero = buildJournalHero(theme, schedule);
  const meta = buildJournalMeta(session);

  // 2. Build Dynamic Layouts
  let dynamicContainer = el('div');
  const updateDynamic = () => {
    const events = classifyEvents(todaysEvents(schedule));
    const target = findNextMainEvent(schedule);
    const banner = buildAlertBanner(target);
    const agenda = buildSegmentedAgenda(events);
    
    dynamicContainer.replaceChildren();
    if (banner) dynamicContainer.append(banner);
    dynamicContainer.append(agenda);
  };
  updateDynamic();

  // 3. Build Action Bar

  root.append(hero, meta, dynamicContainer);

  // Update dynamic parts every minute
  setInterval(updateDynamic, 60 * 1000);
}

function buildJournalHero(theme, schedule) {
  // Pick a random verse from the pool, or fall back to the single verse
  const pool = theme?.verses;
  const v = (pool && pool.length > 0)
    ? pool[Math.floor(Math.random() * pool.length)]
    : (theme?.verse || {});
  let verseKo = String(v.text_ko || '');
  
  // Format Date logic
  const events = todaysEvents(schedule);
  const eventDateObj = events.length > 0 && events[0]._dayDate ? new Date(events[0]._dayDate) : new Date(getNow());
  
  // Use UTC format if we used the schedule date so timezone shifts don't bump it back a day
  const useUTC = events.length > 0 && events[0]._dayDate;
  const dateStr = eventDateObj.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric',
    timeZone: useUTC ? 'UTC' : undefined
  });
  const dayLbl = events.length > 0 && events[0]._dayLabel ? events[0]._dayLabel : 'Day 01';

  return el('section', { class: 'journal-hero reveal d2' },
    el('div', { class: 'date', text: `${dateStr} · ${dayLbl}` }),
    el('blockquote', { text: `"${verseKo}"` }),
    el('cite', { text: v.reference_ko || '' })
  );
}

function buildJournalMeta(session) {
  const name = session.korean_name ? `${session.korean_name} 님` : '환영합니다';
  const room = session.room ? `${session.room}호` : '미배정';
  const cell = session.cell_name ? session.cell_name : '';
  
  const details = el('div', { class: 'details' }, room);
  if (cell) {
    details.append(el('span', { class: 'sep' }), cell);
  }

  return el('div', { class: 'journal-meta reveal d3' },
    el('div', { class: 'name', text: name }),
    details
  );
}

function buildAlertBanner(target) {
  if (!target || !target._start) return null;
  
  const nowMs = getNow();
  const diffMs = target._start - nowMs;
  const diffMins = Math.floor(diffMs / 60000);
  
  // Show banner if event starts within 15 mins (and hasn't started yet)
  if (diffMins > 0 && diffMins <= 15) {
    const icon = svg('0 0 24 24', [
      '<circle cx="12" cy="12" r="10"></circle>',
      '<polyline points="12 6 12 12 16 14"></polyline>'
    ], { strokeWidth: 2.5 });
    icon.classList.add('icon');
    
    return el('div', { class: 'alert-banner reveal d4' },
      icon,
      el('div', { class: 'content' },
        el('div', { class: 'title', text: `${target.title} 시작 ${diffMins}분 전` }),
        el('div', { class: 'desc', text: `곧 ${target.place || '다음 장소'}에서 일정이 시작됩니다. 늦지 않게 이동해주세요.` })
      )
    );
  }
  
  return null;
}

function buildSegmentedAgenda(events) {
  if (events.length === 0) {
    return el('section', { class: 'segmented-agenda reveal d5' },
      el('div', { style: 'padding:32px 16px;text-align:center;color:var(--ink-3);font-size:14px;' },
        '오늘 일정이 없어요.'),
    );
  }

  // Group events by time block
  const groups = {
    '오전': [], '오후': [], '저녁': []
  };
  
  events.forEach(ev => {
    if (!ev.time) return;
    const hour = parseInt(ev.time.split(':')[0], 10);
    if (hour < 12) groups['오전'].push(ev);
    else if (hour < 18) groups['오후'].push(ev);
    else groups['저녁'].push(ev);
  });

  const section = el('section', { class: 'segmented-agenda reveal d5' });
  
  Object.keys(groups).forEach(block => {
    if (groups[block].length === 0) return;
    
    const title = el('div', { class: 'segment-title', text: block });
    // add margin-top to titles after the first
    if (section.children.length > 0) {
      title.style.marginTop = '32px';
    }
    section.append(title);
    
    groups[block].forEach(ev => {
      const row = el('div', { class: `ev minimal ${ev._state}`.trim() },
        el('span', { class: 'time', text: ev.time }),
        el('span', { class: 'title', text: ev.title }),
        el('span', { class: 'place', text: ev.place || '' })
      );
      section.append(row);
    });
  });

  return section;
}

