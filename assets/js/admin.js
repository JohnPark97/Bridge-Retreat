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

  const card = el('section', { class: 'journal-hero reveal d2', style: 'margin-top: 48px;' },
    el('div', { class: 'date', text: 'ADMIN ACCESS' }),
    el('blockquote', { text: '관리자 모드', style: 'font-size: 24px; font-weight: 700; font-style: normal; margin-bottom: 8px;' }),
    el('cite', { text: '이 페이지는 운영팀만 접근할 수 있어요.', style: 'display: block; margin-bottom: 24px;' }),
    form,
  );

  content.append(card);

  // Hide splash
  setTimeout(() => input.focus(), 50);
}

// ─── Bootstrap ───────────────────────────────

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

  loading.remove();

  if (roster.length === 0) {
    content.append(el('div', {
      style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
      text: '명단을 불러오지 못했어요. config.js를 확인해 주세요.',
    }));
    return;
  }

  // Build tab navigation + panels
  let panels = {
    checkin: buildCheckinView(roster, schedule),
    groups:  buildGroupsView(roster, cells),
    rooms:   buildRoomsView(roster),
  };

  const tabBar = buildAdminTabs(panels);
  const logoutFooter = buildLogoutFooter();

  content.append(tabBar, panels.checkin, panels.groups, panels.rooms, logoutFooter);

  // Show first tab
  let activeTab = 'checkin';
  switchAdminTab(activeTab, panels);

  // Auto-refresh every 30 seconds
  setInterval(async () => {
    try {
      const [rR2, cR2] = await Promise.allSettled([loadRoster(), loadCells()]);
      const freshRoster = rR2.status === 'fulfilled' ? rR2.value : roster;
      const freshCells  = cR2.status === 'fulfilled' ? cR2.value : cells;

      // Track which tab is active
      const currentTab = document.querySelector('.admin-tab.active');
      activeTab = currentTab?.dataset?.tab || activeTab;

      // Rebuild panels
      const newPanels = {
        checkin: buildCheckinView(freshRoster, schedule),
        groups:  buildGroupsView(freshRoster, freshCells),
        rooms:   buildRoomsView(freshRoster),
      };

      // Swap in new panels
      panels.checkin.replaceWith(newPanels.checkin);
      panels.groups.replaceWith(newPanels.groups);
      panels.rooms.replaceWith(newPanels.rooms);
      panels = newPanels;

      switchAdminTab(activeTab, panels);
    } catch (e) {
      console.warn('auto-refresh failed', e);
    }
  }, 30000);
}

// ─── Tab Navigation ──────────────────────────

function buildAdminTabs(panels) {
  const tabs = [
    { key: 'checkin', label: '체크인' },
    { key: 'groups',  label: '조별' },
    { key: 'rooms',   label: '방별' },
  ];

  const bar = el('div', { class: 'admin-tabs reveal d2' });

  tabs.forEach(t => {
    const btn = el('button', {
      class: 'admin-tab',
      'data-tab': t.key,
      text: t.label,
    });
    btn.addEventListener('click', () => switchAdminTab(t.key, panels));
    bar.append(btn);
  });

  return bar;
}

function switchAdminTab(key, panels) {
  // Toggle panel visibility
  Object.entries(panels).forEach(([k, panel]) => {
    panel.hidden = (k !== key);
  });

  // Toggle active button
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === key);
  });
}

// ─── Tab 1: Check-in Overview ────────────────

function buildCheckinView(roster, schedule) {
  const panel = el('div', { class: 'admin-panel' });

  // Stats hero
  const total = roster.length;
  const checked = roster.filter(p => !!p.checked_in_at).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  const statsSection = el('div', { class: 'admin-stats reveal d3' },
    el('div', { class: 'admin-stats-number' },
      el('span', { text: String(checked) }),
      el('span', { style: 'color:var(--ink-2); font-weight:700;', text: ` / ${total}` }),
    ),
    el('div', { style: 'font-size:13px; font-weight:700; color:var(--ink-3); margin-bottom:12px;', text: `${pct}% 체크인 완료` }),
    el('div', { class: 'bar', style: 'height:6px;' },
      el('div', { class: 'bar-fill', style: `width:${pct}%` }),
    ),
  );

  // Next event countdown
  if (schedule) {
    const target = findNextMainEvent(schedule);
    if (target) {
      const timer = el('span', { style: 'font-weight:800; font-size:18px; font-feature-settings:"tnum" 1; letter-spacing:-0.02em; color:var(--ink);', text: '—' });
      const nextBlock = el('div', { style: 'margin-top:16px; padding-top:14px; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;' },
        el('div', {},
          el('div', { style: 'font-size:11px; font-weight:700; color:var(--ink-2); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:2px;', text: '다음 일정' }),
          el('div', { style: 'font-weight:700; font-size:14px; color:var(--ink);', text: `${target.title} · ${target.time}` }),
        ),
        timer,
      );
      statsSection.append(nextBlock);
      startCountdown(target, ({ h, m, s, started }) => {
        timer.textContent = started ? '시작됨' : `${pad(h)}:${pad(m)}:${pad(s)}`;
      });
    }
  }

  // Search bar
  const input = el('input', {
    class: 'field',
    type: 'search',
    placeholder: '이름 검색…',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });
  const searchWrap = el('div', { class: 'search-wrap', style: 'margin-top:20px;' },
    svg('0 0 24 24', ICON_SEARCH, { strokeWidth: 2 }),
    input,
  );
  // Give the SVG the icon class for positioning
  searchWrap.querySelector('svg').classList.add('icon');

  // Roster list
  const list = el('div', { style: 'margin-top:8px;' });
  const meta = el('span', { style: 'font-size:12px; font-weight:600; color:var(--ink-2);' });

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

    // Sort: unchecked first, then alphabetical
    const sorted = [...filtered].sort((a, b) => {
      if (!!a.checked_in_at !== !!b.checked_in_at) return a.checked_in_at ? 1 : -1;
      return (a.korean_name || '').localeCompare(b.korean_name || '', 'ko');
    });

    for (const p of sorted) list.append(buildPersonRow(p));
  }

  input.addEventListener('input', e => render(e.target.value));
  render('');

  const listHeader = el('div', { style: 'display:flex; align-items:baseline; justify-content:space-between; padding:16px 8px 8px;' },
    el('span', { style: 'font-size:12px; font-weight:700; color:var(--ink-2); letter-spacing:0.05em; text-transform:uppercase;', text: '명단' }),
    meta,
  );

  panel.append(statsSection, searchWrap, listHeader, list);
  return panel;
}

// ─── Tab 2: Groups View ──────────────────────

function buildGroupsView(roster, cells) {
  const panel = el('div', { class: 'admin-panel' });

  // Aggregate by cell_name
  const groupMap = new Map();
  for (const p of roster) {
    if (!p.cell_name) continue;
    if (!groupMap.has(p.cell_name)) groupMap.set(p.cell_name, []);
    groupMap.get(p.cell_name).push(p);
  }

  // Order: cells sheet first, then extras
  const orderedNames = cells.map(c => c.cell_name).filter(Boolean);
  const known = new Set(orderedNames);
  for (const name of groupMap.keys()) {
    if (!known.has(name)) {
      orderedNames.push(name);
      known.add(name);
    }
  }

  if (orderedNames.length === 0) {
    panel.append(el('div', {
      style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
      text: '그룹 정보가 없어요.',
    }));
    return panel;
  }

  // Summary counts
  const totalGroups = orderedNames.length;
  const allCheckedGroups = orderedNames.filter(name => {
    const members = groupMap.get(name) || [];
    return members.length > 0 && members.every(m => !!m.checked_in_at);
  }).length;

  panel.append(el('div', { style: 'padding:0 8px 16px; font-size:12px; font-weight:700; color:var(--ink-2); letter-spacing:0.05em; text-transform:uppercase;' },
    `${totalGroups}개 조 · ${allCheckedGroups}개 완료`
  ));

  for (const name of orderedNames) {
    const members = groupMap.get(name) || [];
    const checked = members.filter(m => !!m.checked_in_at).length;
    const total = members.length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    const allDone = checked === total && total > 0;

    // Accordion header
    const header = el('div', { class: 'group-accordion-header' },
      el('div', { style: 'display:flex; align-items:center; gap:8px; flex:1;' },
        el('span', { style: `font-size:16px; font-weight:700; color:var(--ink); letter-spacing:-0.01em;`, text: name }),
        allDone ? el('span', { style: 'font-size:10px; font-weight:800; color:var(--ink-4); border:1px solid var(--line); padding:2px 6px; border-radius:99px;', text: '완료' }) : null,
      ),
      el('div', { style: 'display:flex; align-items:center; gap:12px;' },
        el('span', { style: 'font-size:13px; font-weight:700; color:var(--ink-3); font-feature-settings:"tnum" 1;', text: `${checked}/${total}` }),
        el('span', { class: 'accordion-chevron', text: '›' }),
      ),
    );

    // Accordion body (hidden by default)
    const body = el('div', { class: 'group-accordion-body' });
    body.hidden = true;

    // Members inside
    const leaders = members.filter(m => m.is_leader);
    const others = members.filter(m => !m.is_leader);

    if (leaders.length > 0) {
      body.append(el('div', { style: 'font-size:11px; font-weight:700; color:var(--ink-2); letter-spacing:0.05em; text-transform:uppercase; padding:8px 0 4px;', text: '리더' }));
      leaders.forEach(m => body.append(buildPersonRow(m)));
    }
    if (others.length > 0) {
      body.append(el('div', { style: 'font-size:11px; font-weight:700; color:var(--ink-2); letter-spacing:0.05em; text-transform:uppercase; padding:8px 0 4px;', text: '그룹원' }));
      others.forEach(m => body.append(buildPersonRow(m)));
    }

    // Mini progress bar under header
    const progressBar = el('div', { class: 'bar', style: 'height:3px; margin-top:8px;' },
      el('div', { class: 'bar-fill', style: `width:${pct}%` }),
    );

    // Toggle
    header.addEventListener('click', () => {
      const isOpen = !body.hidden;
      body.hidden = isOpen;
      header.classList.toggle('open', !isOpen);
    });

    const card = el('div', { class: 'group-accordion reveal d3' },
      header, progressBar, body,
    );
    panel.append(card);
  }

  return panel;
}

// ─── Tab 3: Rooms View ───────────────────────

function buildRoomsView(roster) {
  const panel = el('div', { class: 'admin-panel' });

  // Group by room
  const roomMap = new Map();
  for (const p of roster) {
    const room = p.room || '미배정';
    if (!roomMap.has(room)) roomMap.set(room, []);
    roomMap.get(room).push(p);
  }

  // Sort room keys numerically
  const roomKeys = [...roomMap.keys()].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b, 'ko');
  });

  panel.append(el('div', { style: 'padding:0 8px 16px; font-size:12px; font-weight:700; color:var(--ink-2); letter-spacing:0.05em; text-transform:uppercase;' },
    `${roomKeys.length}개 방`
  ));

  for (const room of roomKeys) {
    const members = roomMap.get(room);
    const checked = members.filter(m => !!m.checked_in_at).length;
    const allDone = checked === members.length && members.length > 0;
    const roomLabel = room === '미배정' ? room : `${room}호`;

    const sectionLabel = el('div', { style: 'display:flex; align-items:baseline; justify-content:space-between; padding:20px 8px 8px;' },
      el('span', { style: 'font-size:16px; font-weight:800; color:var(--ink); letter-spacing:-0.01em;' },
        roomLabel,
        allDone ? el('span', { style: 'margin-left:8px; font-size:10px; font-weight:800; color:var(--ink-2); border:1px solid var(--line); padding:2px 6px; border-radius:99px; vertical-align:middle;', text: '✓' }) : null,
      ),
      el('span', { style: 'font-size:12px; font-weight:600; color:var(--ink-2);', text: `${checked}/${members.length}` }),
    );

    const memberList = el('div');
    members
      .sort((a, b) => (a.korean_name || '').localeCompare(b.korean_name || '', 'ko'))
      .forEach(m => memberList.append(buildPersonRow(m)));

    panel.append(sectionLabel, memberList);
  }

  return panel;
}

// ─── Shared: Person Row ──────────────────────

function buildPersonRow(p) {
  const checkedIn = !!p.checked_in_at;
  const statusDot = el('span', {
    style: `width:8px; height:8px; border-radius:50%; flex-shrink:0; background:${checkedIn ? 'var(--ink-3)' : 'var(--signal, #E74C3C)'};`,
  });

  const nameText = p.korean_name || '?';
  const details = [p.cell_name, p.room ? `${p.room}호` : ''].filter(Boolean).join(' · ');

  return el('div', { style: 'display:flex; align-items:center; gap:12px; padding:10px 8px;' },
    statusDot,
    el('div', { style: 'flex:1; min-width:0;' },
      el('div', { style: `font-size:15px; font-weight:${checkedIn ? '500' : '700'}; color:${checkedIn ? 'var(--ink-3)' : 'var(--ink)'}; letter-spacing:-0.01em;`, text: nameText }),
      details ? el('div', { style: 'font-size:12px; font-weight:600; color:var(--ink-2); margin-top:1px;', text: details }) : null,
    ),
    checkedIn
      ? el('span', { style: 'font-size:11px; font-weight:600; color:var(--ink-2);', text: formatCheckinTime(p.checked_in_at) })
      : el('span', { style: 'font-size:11px; font-weight:700; color:var(--signal, #E74C3C);', text: '미체크인' }),
  );
}

function formatCheckinTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return ts;
  }
}

// ─── Shared UI ───────────────────────────────

function buildLogoutFooter() {
  return el('div', { style: 'padding:32px 16px 48px;text-align:center;' },
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

