// Tiny DOM helpers — keeps tab code readable without innerHTML.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  applyAttrs(e, attrs);
  appendKids(e, children);
  return e;
}

export function svg(viewBox, paths, opts = {}) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', String(opts.strokeWidth ?? 2.4));
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    s.append(p);
  }
  return s;
}

function applyAttrs(e, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') {
      e.addEventListener(k.slice(2), v);
    } else if (v === true) {
      e.setAttribute(k, '');
    } else {
      e.setAttribute(k, String(v));
    }
  }
}

function appendKids(e, children) {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c))
      : c);
  }
}
