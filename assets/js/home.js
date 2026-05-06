import { el, svg } from './dom.js';
import {
  findNextMainEvent, todaysEvents, classifyEvents, getNow,
} from './countdown.js';
import { CONFIG } from './config.js';
import { patchSession } from './auth.js';
import { showToast } from './ui.js';

const pad = n => String(n).padStart(2, '0');

export function renderHome(ctx) {
  const { session, theme, schedule } = ctx;
  const root = document.getElementById('home');
  root.replaceChildren();

  // 1. Build Static Layouts
  const hero = buildJournalHero(theme, schedule);
  const meta = buildJournalMeta(session);
  const checkin = buildInlineCheckin(session);

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

  root.append(hero, meta, ...(checkin ? [checkin] : []), dynamicContainer);

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

  const section = el('section', { class: 'segmented-agenda reveal d5' });
  
  events.forEach(ev => {
    const row = el('div', { class: `ev minimal ${ev._state}`.trim() },
      el('span', { class: 'time', text: ev.time }),
      el('span', { class: 'title', text: ev.title }),
      el('span', { class: 'place', text: ev.place || '' })
    );
    section.append(row);
  });

  return section;
}

// ─── Inline Check-in ─────────────────────────

function buildInlineCheckin(session) {
  if (session.checked_in_at) {
    return null;
  }

  const container = el('div', { class: 'inline-checkin reveal d4' });

  // Not checked in — gentle prompt
  const btn = el('button', { class: 'checkin-btn', type: 'button' }, '체크인');
  const label = el('div', { class: 'checkin-prompt' },
    el('span', { class: 'checkin-dot pending' }),
    el('span', { text: '수련회장에 잘 도착하셨나요?' }),
  );

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '확인 중…';
    try {
      const ts = await submitCheckin(session.id);
      patchSession({ checked_in_at: ts });
      // Replace with room direction
      container.replaceChildren(
        el('div', { class: 'checkin-done' },
          el('span', { text: `환영합니다! ${session.room ? session.room + '호' : '배정된 방'}으로 이동해 주세요.` }),
        )
      );
      setTimeout(() => container.remove(), 5000);
      showToast('체크인 완료!');
    } catch (err) {
      console.error('checkin failed', err);
      btn.disabled = false;
      btn.textContent = '체크인';
      showToast('연결에 문제가 있어요. 다시 시도해 주세요.');
    }
  });

  container.append(
    el('div', { style: 'display:flex; align-items:center; justify-content:space-between;' },
      label, btn,
    )
  );
  return container;
}

async function submitCheckin(userId) {
  const url = CONFIG.APPS_SCRIPT_URL;

  // Dev mode — Apps Script not configured
  if (!url || /^PASTE_/.test(url)) {
    console.warn('Apps Script not configured — skipping remote write');
    return new Date().toISOString();
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      secret:  CONFIG.APPS_SCRIPT_SECRET,
      action:  'checkin',
      user_id: userId,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.err || 'unknown');
  return data.checked_in_at || new Date().toISOString();
}

