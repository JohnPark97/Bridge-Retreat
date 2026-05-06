import { el, svg } from './dom.js';
import { CONFIG } from './config.js';
import { patchSession } from './auth.js';
import { showToast } from './ui.js';

const ICON_HOUSE = ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'];

export function maybeShowCheckin(session) {
  if (session.checked_in_at) return;
  showCheckinOverlay(session);
}

function showCheckinOverlay(session) {
  const overlay = buildOverlay(session);
  document.body.append(overlay);
  // Trigger CSS opacity transition by removing .hidden after a frame
  requestAnimationFrame(() => overlay.classList.remove('hidden'));
}

function buildOverlay(session) {
  const submitBtn = el('button', { class: 'btn', type: 'button' }, '체크인 완료');
  const linkBtn   = el('button', { class: 'btn-link', type: 'button' }, '잠시 후에 할게요');

  const card = el('div', { class: 'overlay-card' },
    el('div', { class: 'icon' },
      el('span', { text: String(session.room ?? '') }),
    ),
    el('h2', { text: `${session.room ?? ''}호에 잘 도착하셨나요?` }),
    el('p', {
      text: '배정된 방에 짐을 두셨다면 체크인을 해 주세요. 도움이 필요하시면 안내 데스크에 문의해 주세요.',
    }),
    submitBtn,
    linkBtn,
  );

  // Start hidden, fade in via removing class after mount
  const overlay = el('div', { class: 'overlay hidden', role: 'dialog' }, card);

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = '확인 중...';
    try {
      const ts = await submitCheckin(session.id);
      patchSession({ checked_in_at: ts });
      hide(overlay);
      showToast('체크인 완료!');
    } catch (err) {
      console.error('checkin failed', err);
      submitBtn.disabled = false;
      submitBtn.textContent = '체크인 완료';
      showToast('연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.');
    }
  });

  linkBtn.addEventListener('click', () => hide(overlay));
  return overlay;
}

function hide(overlay) {
  overlay.classList.add('hidden');
  setTimeout(() => overlay.remove(), 400);
}

async function submitCheckin(userId) {
  const url = CONFIG.APPS_SCRIPT_URL;

  // Dev mode — Apps Script not configured. Skip remote write but pretend it worked.
  if (!url || /^PASTE_/.test(url)) {
    console.warn('Apps Script not configured — skipping remote write');
    return new Date().toISOString();
  }

  // text/plain avoids the CORS preflight that Apps Script doesn't handle.
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
