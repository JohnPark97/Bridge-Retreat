import { el } from './dom.js';
import { ROOM_COORDS } from './room-coords.js';

/**
 * Render the User View Map
 * @param {HTMLElement} container The DOM element to append the map and info to
 * @param {Object} currentUser The current user's data
 * @param {Array} roster The full roster
 */
export function renderUserMap(container, currentUser, roster) {
  if (!currentUser || !currentUser.room) {
    container.append(el('div', {
      style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
      text: '배정된 방이 없습니다.',
    }));
    return;
  }

  const roomNum = parseInt(currentUser.room);
  const floor = Math.floor(roomNum / 100);
  const coords = ROOM_COORDS[roomNum];
  const roommates = roster.filter(p => p.room === currentUser.room && p.korean_name !== currentUser.korean_name);
  const roommateNames = roommates.map(m => m.korean_name).join(' · ');

  // 0. Section Header
  const sectionHeader = el('div', { class: 'journal-hero reveal d2' },
    el('div', { class: 'date' }, 'MAP'),
    el('h1', { class: 'hero-title', style: 'font-size: 28px;' }, '내 방 위치')
  );

  // 1. Room Meta (Matches journal style in app.html)
  const roomMeta = el('div', { class: 'journal-meta reveal d3' },
    el('div', { class: 'name' }, `${floor}층 ${roomNum}호`),
    el('div', { class: 'details' },
      el('span', {}, currentUser.korean_name),
      roommateNames ? el('div', { class: 'sep' }) : null,
      roommateNames ? el('span', {}, roommateNames) : null
    )
  );

  // 2. Map Image & Pin
  const mapWrap = el('div', { class: 'dorm-map-wrap' });
  const mapImg = el('img', { class: 'dorm-map-img', src: 'assets/imgs/dorm map.png', alt: 'Dorm Map' });
  mapWrap.append(mapImg);

  if (coords) {
    // Build pin: theme-matching pulsing dot (no label as requested)
    const dot = el('div', { class: 'map-dot-me' });

    const pin = el('div', {
      class: 'room-pin room-pin--me',
      style: `left:${coords.x}%; top:${coords.y}%;`,
    });
    pin.append(dot);
    mapWrap.append(pin);
  }

  const mapSection = el('div', { class: 'map-section', style: 'margin-top: 16px; margin-bottom: 48px;' }, mapWrap);

  container.append(sectionHeader, roomMeta, mapSection);
}

/**
 * Render the Admin View Map
 * @param {HTMLElement} container The DOM element to append the map to
 * @param {Map} roomMap Map of room -> [members]
 */
export function renderAdminMap(container, roomMap) {
  // 1. Legend
  const legend = el('div', { class: 'map-legend' },
    el('span', { class: 'item' }, el('span', { class: 'swatch warn' }), ' 미완료'),
    el('span', { class: 'item' }, el('span', { class: 'swatch ok' }), ' 전원 체크인')
  );

  // 2. Map & Pins
  const mapWrap = el('div', { class: 'dorm-map-wrap', id: 'admin-map-wrap' });
  const mapImg = el('img', { class: 'dorm-map-img', src: 'assets/imgs/dorm map.png', alt: 'Dorm Map' });
  mapWrap.append(mapImg);

  for (const [room, members] of roomMap.entries()) {
    const roomNum = parseInt(room);
    if (isNaN(roomNum)) continue; // Skip '미배정'

    const coords = ROOM_COORDS[roomNum];
    if (!coords) continue;

    const checkedIn = members.filter(m => !!m.checked_in_at).length;
    const total = members.length;
    const allDone = checkedIn === total && total > 0;

    // Create detailed tooltip content
    const memberRows = members.map(m => el('div', { class: 'tooltip-row' },
      el('span', { class: 'tooltip-name' }, m.korean_name),
      el('span', {
        class: `tooltip-status ${m.checked_in_at ? 'in' : 'out'}`,
        text: m.checked_in_at ? '✓' : '○'
      })
    ));

    const tooltip = el('div', { class: 'tooltip' },
      el('div', { class: 'tooltip-header' }, `${room}호 · ${checkedIn}/${total}`),
      el('div', { class: 'tooltip-body' }, memberRows)
    );

    const dot = el('div', { class: 'dot' }, String(total));

    const pin = el('div', {
      class: `room-pin room-pin--status ${allDone ? 'ok' : 'warn'}`,
      style: `left:${coords.x}%; top:${coords.y}%;`,
    });
    pin.append(dot, tooltip);

    // Scroll to section on click
    pin.addEventListener('click', () => {
      const sectionId = `room-section-${room}`;
      const section = document.getElementById(sectionId);
      if (section) {
        const y = section.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });

    mapWrap.append(pin);
  }

  const mapSection = el('div', { class: 'map-section', style: 'margin-top: 16px; margin-bottom: 32px;' }, mapWrap);

  container.append(legend, mapSection);
}
