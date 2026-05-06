import { CONFIG } from './config.js';
import { el, svg } from './dom.js';
import { loadSchedule, loadRoster, loadCells } from './data.js';
import { findNextMainEvent, getNow, startCountdown } from './countdown.js';

const ICON_SEARCH = ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.3-4.3'];
const pad = n => String(n).padStart(2, '0');

if (sessionStorage.getItem(CONFIG.ADMIN_SESSION_KEY) === '1') {
  bootstrap();
} else {
  showGate();
}

// ─── Gate ────────────────────────────────────

function showGate() {
  const content = document.getElementById('content');
  content.replaceChildren();

  const input = el('input', {
    class: 'field',
    type: 'password',
    id: 'admin-pass',
    placeholder: '관리자 비밀번호',
    autocomplete: 'current-password',
  });
  const btn   = el('button', { class: 'btn', type: 'submit' }, '입장하기');
  const error = el('div', { class: 'error-text', role: 'alert', 'aria-live': 'polite' });

  const form = el('form', { autocomplete: 'off' },
    el('div', { style: 'display:flex;flex-direction:column;gap:10px;' },
      input,
      btn,
    ),
    error,
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    error.textContent = '';

    const expected = CONFIG.ADMIN_PASSWORD;
    if (!expected || /^CHANGE_ME/.test(expected)) {
      error.textContent = '관리자 비밀번호가 설정되지 않았어요.';
      return;
    }
    if (input.value === expected) {
      sessionStorage.setItem(CONFIG.ADMIN_SESSION_KEY, '1');
      bootstrap();
    } else {
      error.textContent = '비밀번호가 맞지 않아요.';
      input.value = '';
      input.focus();
    }
  });

  const card = el('section', { class: 'login reveal d2', style: 'margin-top:48px;' },
    el('div', { class: 'brand' }, el('span', { class: 'logo' }), 'Admin'),
    el('h1', { text: '관리자 모드' }),
    el('p', { class: 'sub', text: '이 페이지는 운영팀만 접근할 수 있어요.' }),
    form,
  );

  content.append(card);
  setTimeout(() => input.focus(), 50);
}

// ─── Dashboard ───────────────────────────────

async function bootstrap() {
  const content = document.getElementById('content');
  content.replaceChildren();

  const loading = el('div', {
    style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
    text: '데이터 불러오는 중…',
  });
  content.append(loading);

  const [sR, rR, cR] = await Promise.allSettled([
    loadSchedule(), loadRoster(), loadCells(),
  ]);
  const schedule = sR.status === 'fulfilled' ? sR.value : null;
  const roster   = rR.status === 'fulfilled' ? rR.value : [];
  const cells    = cR.status === 'fulfilled' ? cR.value : [];

  if (rR.status === 'rejected') console.warn('roster failed', rR.reason);
  if (cR.status === 'rejected') console.warn('cells failed', cR.reason);

  setTopbarDay(schedule);
  loading.remove();

  if (roster.length === 0) {
    content.append(el('div', {
      style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
      text: '명단을 불러오지 못했어요. config.js의 ROSTER_CSV_URL을 확인해 주세요.',
    }));
    return;
  }

  content.append(
    buildStats(roster, schedule),
    buildCellBreakdown(roster, cells),
    buildRosterSearch(roster, cells),
    buildLogoutFooter(),
  );
}

function buildStats(roster, schedule) {
  const total = roster.length;
  const checked = roster.filter(p => !!p.checked_in_at).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const target = schedule ? findNextMainEvent(schedule) : null;
  const timer = el('div', { class: 'timer', text: '—' });
  const nextName = el('div', { class: 'name', text: '—' });

  const card = el('section', { class: 'stats reveal d2' },
    el('span', { class: 'lbl', text: '체크인 현황' }),
    el('div', { class: 'big' },
      el('span', { text: String(checked) }),
      el('span', { class: 'tot', text: ` / ${total}` }),
    ),
    el('div', { class: 'pct', text: `${pct}% 체크인 완료` }),
    el('div', { class: 'bar' },
      el('div', { class: 'bar-fill', style: `width:${pct}%` }),
    ),
    target
      ? el('div', { class: 'next' },
          el('div', {},
            el('div', { class: 'label', text: '다음 일정' }),
            nextName,
          ),
          timer,
        )
      : null,
  );

  if (target) {
    nextName.textContent = `${target.title} · ${target.time}`;
    startCountdown(target, ({ h, m, s, started }) => {
      timer.textContent = started ? '시작됨' : `${pad(h)}:${pad(m)}:${pad(s)}`;
    });
  }
  return card;
}

function buildCellBreakdown(roster, cells) {
  // Aggregate roster by cell_name
  const stats = new Map();
  for (const p of roster) {
    if (!p.cell_name) continue;
    if (!stats.has(p.cell_name)) stats.set(p.cell_name, { total: 0, checked: 0 });
    const s = stats.get(p.cell_name);
    s.total++;
    if (p.checked_in_at) s.checked++;
  }

  // Display order: cells sheet first, then any names that appear only in roster
  const orderedNames = cells.map(c => c.cell_name).filter(Boolean);
  const known = new Set(orderedNames);
  for (const p of roster) {
    if (p.cell_name && !known.has(p.cell_name)) {
      orderedNames.push(p.cell_name);
      known.add(p.cell_name);
    }
  }

  if (orderedNames.length === 0) {
    return el('section', { class: 'cell-card reveal d3' },
      el('div', { class: 'head' },
        el('span', { class: 'title', text: '그룹별 체크인' }),
      ),
      el('div', {
        style: 'padding:24px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
        text: '그룹 정보가 없어요.',
      }),
    );
  }

  const rows = orderedNames.map(name => {
    const s = stats.get(name) || { total: 0, checked: 0 };
    const pctNum = s.total > 0 ? (s.checked / s.total) * 100 : 0;
    return el('div', { class: 'cell-row' },
      el('div', { class: 'label', text: name }),
      el('div', { class: 'frac', text: `${s.checked}/${s.total}` }),
      el('div', { class: 'bar' },
        el('div', { class: 'bar-fill', style: `width:${pctNum}%` }),
      ),
    );
  });

  return el('section', { class: 'cell-card reveal d3' },
    el('div', { class: 'head' },
      el('span', { class: 'title', text: '그룹별 체크인' }),
      el('span', { class: 'meta', text: `${orderedNames.length}개 조` }),
    ),
    ...rows,
  );
}

function buildRosterSearch(roster, cells) {
  // cell_name is the FK and the display label — no map needed.
  const input = el('input', {
    class: 'field',
    type: 'search',
    placeholder: '이름 검색…',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });

  const list = el('div');
  const meta = el('span', { class: 'meta' });

  function render(query) {
    list.replaceChildren();
    const q = (query || '').trim().toLowerCase();
    const filtered = q
      ? roster.filter(p => (p.korean_name || '').toLowerCase().includes(q))
      : roster;

    meta.textContent = q
      ? `${filtered.length}명 / ${roster.length}명`
      : `${roster.length}명`;

    if (filtered.length === 0) {
      list.append(el('div', {
        style: 'padding:32px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
        text: '결과가 없어요.',
      }));
      return;
    }

    // Sort: not-checked-in first, then alphabetical
    const sorted = [...filtered].sort((a, b) => {
      if (!!a.checked_in_at !== !!b.checked_in_at) return a.checked_in_at ? 1 : -1;
      return (a.korean_name || '').localeCompare(b.korean_name || '', 'ko');
    });

    for (const p of sorted) list.append(buildRosterRow(p));
  }

  input.addEventListener('input', e => render(e.target.value));
  render('');

  return el('section', { class: 'reveal d4' },
    el('div', { class: 'search-wrap' },
      svg('0 0 24 24', ICON_SEARCH, { strokeWidth: 2 }),
      input,
    ),
    el('section', { class: 'cell-card', style: 'padding-top:8px;' },
      el('div', { class: 'head', style: 'padding-bottom:6px;' },
        el('span', { class: 'title', text: '명단' }),
        meta,
      ),
      list,
    ),
  );
}

function buildRosterRow(p) {
  const initial = (p.korean_name || '?').slice(0, 1);
  const cellName = p.cell_name || '';
  const checkedIn = !!p.checked_in_at;

  const nameStr = cellName
    ? `${p.korean_name || '?'} · ${cellName}`
    : (p.korean_name || '?');

  return el('div', { class: `roster-row ${checkedIn ? 'in' : ''}`.trim() },
    el('div', { class: 'avatar', text: initial }),
    el('div', { class: 'name', text: nameStr }),
    el('div', { class: 'room', text: p.room ? `${p.room}호` : '' }),
    el('div', { class: 'check', text: checkedIn ? '✓' : '·' }),
  );
}

function buildLogoutFooter() {
  return el('div', { style: 'padding:24px 16px;text-align:center;' },
    el('button', {
      class: 'btn-link',
      type: 'button',
      onclick: () => {
        sessionStorage.removeItem(CONFIG.ADMIN_SESSION_KEY);
        location.reload();
      },
    }, '로그아웃'),
  );
}

function setTopbarDay(schedule) {
  const today = new Date(getNow());
  const todayKey = isoDate(today);
  let label = '';
  if (schedule) {
    const day = schedule.days.find(d => isoDate(new Date(d.date)) === todayKey);
    label = day ? day.label : '';
  }
  const dateLabel = `${pad(today.getMonth() + 1)}.${pad(today.getDate())}`;
  const pill = document.getElementById('day-pill');
  if (pill) pill.textContent = label ? `${label} · ${dateLabel}` : dateLabel;
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
