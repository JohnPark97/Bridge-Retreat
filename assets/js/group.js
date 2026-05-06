import { el, svg } from './dom.js';

const ICON_PIN = ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z'];
const PIN_DOT  = ['M12 12a2 2 0 100-4 2 2 0 000 4z'];

export function renderGroup(ctx) {
  const { session, roster, cells } = ctx;
  const root = document.getElementById('group');
  root.replaceChildren();

  const myCellName = session.cell_name;
  const cell = cells.find(c => c.cell_name === myCellName);

  if (!myCellName) {
    root.append(emptyState('아직 그룹이 배정되지 않았어요.'));
    return;
  }

  // Group info card
  root.append(buildGroupInfo(cell, myCellName));

  // Members card
  const groupMembers = roster
    .filter(p => p.cell_name === myCellName)
    .sort((a, b) => {
      // leaders first, then by name
      if (a.is_leader !== b.is_leader) return a.is_leader ? -1 : 1;
      return (a.korean_name || '').localeCompare(b.korean_name || '', 'ko');
    });

  root.append(buildMembers(groupMembers, session));
}

function buildGroupInfo(cell, fallbackName) {
  const cellName = cell?.cell_name || fallbackName || '';
  const meetingRoom = cell?.meeting_room || '미정';

  const pinIcon = svg('0 0 24 24', [...ICON_PIN, ...PIN_DOT], { strokeWidth: 2 });
  pinIcon.style.width = '16px';
  pinIcon.style.height = '16px';
  pinIcon.style.color = 'var(--ink-3)';
  pinIcon.style.flexShrink = '0';

  return el('section', { class: 'journal-hero reveal d2', style: 'margin-bottom: 0;' },
    el('div', { class: 'date' }, '내 조원'),
    el('blockquote', { style: 'font-size: 28px; font-style: normal; margin-bottom: 12px; font-weight: 700;' }, cellName),
    el('cite', { style: 'font-size: 13px; font-weight: 600; color: var(--ink-3); display: flex; align-items: center; justify-content: center; gap: 6px;' },
      pinIcon,
      meetingRoom
    )
  );
}

function buildMembers(members, session) {
  const head = el('div', { class: 'head' },
    el('span', { class: 'title', text: '그룹원' }),
    el('span', { class: 'meta', text: members.length ? `${members.length}명` : '' }),
  );

  if (members.length === 0) {
    return el('section', { class: 'segmented-agenda reveal d3' },
      el('div', { style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;' },
        '아직 등록된 그룹원이 없어요.'),
    );
  }

  const leaders = members.filter(m => m.is_leader);
  const others  = members.filter(m => !m.is_leader);

  const labelStyle = 'font-size: 12px; font-weight: 700; color: var(--ink-4); margin: 24px 8px 12px; letter-spacing: 0.05em; text-transform: uppercase;';
  const gridStyle = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 0 8px; margin-bottom: 24px;';
  
  const children = [];
  if (leaders.length > 0) {
    children.push(el('div', { style: labelStyle, text: '리더' }));
    children.push(el('div', { style: gridStyle }, ...leaders.map(m => buildMemberCell(m, session))));
  }
  if (others.length > 0) {
    children.push(el('div', { style: labelStyle, text: '그룹원' }));
    children.push(el('div', { style: gridStyle }, ...others.map(m => buildMemberCell(m, session))));
  }

  return el('section', { class: 'segmented-agenda reveal d3', style: 'padding: 0 12px;' }, ...children);
}

function buildMemberCell(person, session) {
  const isMe = person.id === session.id;
  
  const nameNode = el('span', { 
    style: `font-size: 16px; letter-spacing: -0.01em; ${isMe ? 'font-weight: 800; color: var(--ink);' : 'font-weight: 600; color: var(--ink-2);'}`, 
    text: person.korean_name || '?' 
  });
  
  return el('div', { style: 'display: flex; align-items: baseline; gap: 8px;' },
    nameNode,
    el('span', { style: 'font-size: 12px; font-weight: 600; color: var(--ink-4);', text: person.room ? `${person.room}호` : '' })
  );
}

function emptyState(msg) {
  return el('div', {
    style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
    text: msg,
  });
}
