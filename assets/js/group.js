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

  return el('section', { class: 'hero reveal d2' },
    el('div', { class: 'greet' }, '내 그룹'),
    el('h1', {},
      el('span', { class: 'gr', text: cellName }),
    ),
    el('div', { class: 'meta' },
      el('span', { class: 'chip accent' },
        svg('0 0 24 24', [...ICON_PIN, ...PIN_DOT], { strokeWidth: 2.4 }),
        ` 모임 장소 · ${meetingRoom}`,
      ),
    ),
  );
}

function buildMembers(members, session) {
  const head = el('div', { class: 'head' },
    el('span', { class: 'title', text: '그룹원' }),
    el('span', { class: 'meta', text: members.length ? `${members.length}명` : '' }),
  );

  if (members.length === 0) {
    return el('section', { class: 'members reveal d3' },
      head,
      el('div', { style: 'padding:24px 16px;text-align:center;color:var(--ink-3);font-size:14px;' },
        '아직 등록된 그룹원이 없어요.'),
    );
  }

  const leaders = members.filter(m => m.is_leader);
  const others  = members.filter(m => !m.is_leader);

  const children = [head];
  if (leaders.length > 0) {
    children.push(el('div', { class: 'section-divider', text: '리더' }));
    leaders.forEach(m => children.push(buildMemberRow(m, session, true)));
  }
  if (others.length > 0) {
    children.push(el('div', { class: 'section-divider', text: '그룹원' }));
    others.forEach(m => children.push(buildMemberRow(m, session, false)));
  }

  return el('section', { class: 'members reveal d3' }, ...children);
}

function buildMemberRow(person, session, isLeader) {
  const initial = (person.korean_name || '?').slice(0, 1);
  const isMe = person.id === session.id;

  const nameNode = el('span', { class: 'name', text: person.korean_name || '?' });
  if (isMe) {
    nameNode.append(el('span', { class: 'me', text: '나' }));
  }
  if (isLeader) {
    nameNode.append(el('span', { class: 'role', text: '리더' }));
  }

  return el('div', { class: `member-row ${isLeader ? 'leader' : ''}`.trim() },
    el('div', { class: 'avatar', text: initial }),
    nameNode,
    el('div', { class: 'room', text: person.room ? `${person.room}호` : '' }),
  );
}

function emptyState(msg) {
  return el('div', {
    style: 'padding:48px 16px;text-align:center;color:var(--ink-3);font-size:14px;',
    text: msg,
  });
}
