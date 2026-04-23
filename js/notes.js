'use strict';

const NOTES_STORE = 'dnotes_';
const CONN_STORE  = 'dconn_';
const DOT_SIZE    = 26;
const ZOOM_MIN    = 0.25;
const ZOOM_MAX    = 3;
const ZOOM_STEP   = 0.15;

const LINK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

let _notes         = [];
let _connections   = [];
let _panX          = 0;
let _panY          = 0;
let _zoom          = 1;
let _panActive     = false;
let _panSX = 0, _panSY = 0, _panOX = 0, _panOY = 0;
let _pointers      = new Map();
let _prevPinchDist = 0;
let _panInited     = false;

// ── Storage ────────────────────────────────────────────
function _loadNotes() {
  const key = NOTES_STORE + dateKey(state.currentDate);
  try { _notes = JSON.parse(localStorage.getItem(key)) || []; }
  catch (_) { _notes = []; }
}

function _persistNotes() {
  localStorage.setItem(NOTES_STORE + dateKey(state.currentDate), JSON.stringify(_notes));
}

function _loadConnections() {
  const key = CONN_STORE + dateKey(state.currentDate);
  try { _connections = JSON.parse(localStorage.getItem(key)) || []; }
  catch (_) { _connections = []; }
}

function _persistConnections() {
  localStorage.setItem(CONN_STORE + dateKey(state.currentDate), JSON.stringify(_connections));
}

// ── Public ─────────────────────────────────────────────
function renderNotes() {
  _loadNotes();
  _loadConnections();
  _panX = 0; _panY = 0; _zoom = 1;
  const $canvas = document.getElementById('notesCanvas');
  if (!$canvas) return;
  $canvas.innerHTML = '';
  _buildConnectorsSvg($canvas);
  _notes.forEach(n => _buildNoteCard(n, $canvas));
  _redrawConnections();
  _applyTransform();
  if (!_panInited) { _initInteraction(); _panInited = true; }
}

function addNote() {
  const $wrap = document.getElementById('notesCanvasWrap');
  const r = $wrap.getBoundingClientRect();
  const w = 220, h = 200;
  const cxW = (r.width  / 2 - _panX) / _zoom;
  const cyW = (r.height / 2 - _panY) / _zoom;
  const step = _notes.length % 12;
  const off  = step * 22;
  const note = {
    id: uid(), title: '', body: '',
    x: cxW - w / 2 + off,
    y: cyW - h / 2 + off,
    w, h, color: 0,
  };
  _notes.push(note);
  _persistNotes();
  const el = _buildNoteCard(note, document.getElementById('notesCanvas'));
  el.querySelector('.nc-title').focus();
}

// ── Transform ──────────────────────────────────────────
function _applyTransform() {
  const $canvas = document.getElementById('notesCanvas');
  const $wrap   = document.getElementById('notesCanvasWrap');
  const $pct    = document.getElementById('nzbPct');

  if ($canvas) {
    $canvas.style.transform = `translate(${_panX}px,${_panY}px) scale(${_zoom})`;
  }
  if ($wrap) {
    const dotPx = DOT_SIZE * _zoom;
    const bx = ((_panX % dotPx) + dotPx) % dotPx;
    const by = ((_panY % dotPx) + dotPx) % dotPx;
    $wrap.style.backgroundSize     = `${dotPx}px ${dotPx}px`;
    $wrap.style.backgroundPosition = `${bx}px ${by}px`;
  }
  if ($pct) $pct.textContent = `${Math.round(_zoom * 100)}%`;
}

// ── Zoom helpers ───────────────────────────────────────
function _zoomAround(cx, cy, newZoom) {
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  if (newZoom === _zoom) return;
  const r = newZoom / _zoom;
  _panX = cx - (cx - _panX) * r;
  _panY = cy - (cy - _panY) * r;
  _zoom = newZoom;
  _applyTransform();
}

function _zoomCenter(delta) {
  const $wrap = document.getElementById('notesCanvasWrap');
  if (!$wrap) return;
  const r = $wrap.getBoundingClientRect();
  _zoomAround(r.left + r.width / 2, r.top + r.height / 2, _zoom + delta);
}

function _getPinchInfo() {
  const pts = [..._pointers.values()];
  if (pts.length < 2) return null;
  const [a, b] = pts;
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  };
}

// ── Interaction: pan + pinch + wheel ──────────────────
function _initInteraction() {
  const $wrap = document.getElementById('notesCanvasWrap');
  if (!$wrap) return;

  // ── Pointer: pan & pinch ──
  $wrap.addEventListener('pointerdown', e => {
    // Don't steal touch from cards, zoom bar, or connector handles/paths
    if (e.target.closest('.note-card')
        || e.target.closest('.notes-zoom-bar')
        || e.target.closest('.conn-hit')
        || e.target.closest('.conn-cp')) return;
    e.preventDefault();
    $wrap.setPointerCapture(e.pointerId);
    _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (_pointers.size === 1) {
      _panActive = true;
      _panSX = e.clientX; _panSY = e.clientY;
      _panOX = _panX;     _panOY = _panY;
      $wrap.classList.add('panning');
    } else if (_pointers.size === 2) {
      _panActive = false;
      const p = _getPinchInfo();
      _prevPinchDist = p ? p.dist : 0;
    }
  });

  $wrap.addEventListener('pointermove', e => {
    _updateHandleProximity(e.clientX, e.clientY);
    // Only track pointers that originated on the wrap (not card drags bubbling up)
    if (!_pointers.has(e.pointerId)) return;
    _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (_pointers.size >= 2 && _prevPinchDist > 0) {
      const p = _getPinchInfo();
      if (p) {
        _zoomAround(p.cx, p.cy, _zoom * (p.dist / _prevPinchDist));
        _prevPinchDist = p.dist;
      }
    } else if (_panActive && _pointers.size === 1) {
      _panX = _panOX + (e.clientX - _panSX);
      _panY = _panOY + (e.clientY - _panSY);
      _applyTransform();
    }
  });

  const _endPointer = e => {
    _pointers.delete(e.pointerId);
    if (_pointers.size < 2) _prevPinchDist = 0;
    if (_pointers.size === 0) {
      _panActive = false;
      $wrap.classList.remove('panning');
    } else if (_pointers.size === 1) {
      // One finger remains — resume pan from current position
      const rem = _pointers.values().next().value;
      _panSX = rem.x; _panSY = rem.y;
      _panOX = _panX; _panOY = _panY;
      _panActive = true;
    }
  };
  $wrap.addEventListener('pointerup',     _endPointer);
  $wrap.addEventListener('pointercancel', _endPointer);

  // ── Wheel: trackpad pan / pinch gesture / Ctrl+scroll zoom ──
  $wrap.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey) {
      // macOS pinch gesture or Ctrl+wheel
      const factor = Math.pow(0.992, e.deltaY);
      _zoomAround(e.clientX, e.clientY, _zoom * factor);
    } else {
      _panX -= e.deltaX;
      _panY -= e.deltaY;
      _applyTransform();
    }
  }, { passive: false });

  // Hide handles when pointer leaves the canvas entirely
  $wrap.addEventListener('pointerleave', () => {
    document.querySelectorAll('.conn-handles').forEach(h => { h.style.opacity = '0'; });
  });

  // ── Zoom bar ──
  document.getElementById('nzbPlus') ?.addEventListener('click', e => { e.stopPropagation(); _zoomCenter(+ZOOM_STEP); });
  document.getElementById('nzbMinus')?.addEventListener('click', e => { e.stopPropagation(); _zoomCenter(-ZOOM_STEP); });
}

// ── Build card ─────────────────────────────────────────
function _buildNoteCard(note, $canvas) {
  const el = document.createElement('div');
  el.className  = 'note-card';
  el.dataset.nid = note.id;
  _applyCardStyle(el, note);

  el.innerHTML = `
    <div class="nc-top">
      <input class="nc-title" placeholder="Titolo…" />
      <button class="nc-link" aria-label="Collega">${LINK_SVG}</button>
      <button class="nc-color" aria-label="Colore"></button>
      <button class="nc-del" aria-label="Elimina">${SVG.cross}</button>
    </div>
    <textarea class="nc-body" placeholder="Scrivi qui…"></textarea>
    <div class="nc-grip"></div>
  `;

  el.querySelector('.nc-title').value = note.title;
  el.querySelector('.nc-body').value  = note.body;
  _styleColorDot(el.querySelector('.nc-color'), note.color);
  _bindCard(el, note);
  $canvas.appendChild(el);
  return el;
}

function _applyCardStyle(el, note) {
  el.style.left   = `${note.x}px`;
  el.style.top    = `${note.y}px`;
  el.style.width  = `${note.w}px`;
  el.style.height = `${note.h}px`;
  el.style.setProperty('--nc-bg',     PASTEL_BG[note.color]     || PASTEL_BG[0]);
  el.style.setProperty('--nc-accent', ACCENT_COLORS[note.color] || ACCENT_COLORS[0]);
}

function _styleColorDot($btn, idx) {
  $btn.style.background = ACCENT_COLORS[idx] || ACCENT_COLORS[0];
}

// ── Card events ────────────────────────────────────────
function _bindCard(el, note) {
  const $title = el.querySelector('.nc-title');
  const $body  = el.querySelector('.nc-body');
  const $color = el.querySelector('.nc-color');
  const $del   = el.querySelector('.nc-del');
  const $top   = el.querySelector('.nc-top');
  const $grip  = el.querySelector('.nc-grip');
  const $link  = el.querySelector('.nc-link');

  $title.addEventListener('input', () => { note.title = $title.value; _persistNotes(); });
  $body.addEventListener('input',  () => { note.body  = $body.value;  _persistNotes(); });

  // Stop canvas pan on card touch, bring card to front
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    _bringToFront(el);
  });

  // Drag from header bar (not when the target is an interactive child)
  $top.addEventListener('pointerdown', e => {
    if (e.target === $title
        || e.target.closest('.nc-color')
        || e.target.closest('.nc-del')
        || e.target.closest('.nc-link')) return;
    _startMove(e, el, note);
  });

  // Color picker
  $color.addEventListener('pointerdown', e => e.stopPropagation());
  $color.addEventListener('click',       e => { e.stopPropagation(); _openPicker(el, note, $color); });

  // Connector drag — create a link to another note
  $link.addEventListener('pointerdown', e => { e.stopPropagation(); _startConnDrag(e, note); });
  $link.addEventListener('click',       e => e.stopPropagation());

  // Delete (also cascade-remove connections touching this note)
  $del.addEventListener('pointerdown', e => e.stopPropagation());
  $del.addEventListener('click', e => {
    e.stopPropagation();
    _notes = _notes.filter(n => n.id !== note.id);
    _connections = _connections.filter(c => c.fromId !== note.id && c.toId !== note.id);
    _persistNotes();
    _persistConnections();
    el.remove();
    _redrawConnections();
  });

  // Resize grip
  $grip.addEventListener('pointerdown', e => { e.stopPropagation(); _startResize(e, el, note); });
}

function _bringToFront(el) {
  const $c = document.getElementById('notesCanvas');
  if ($c && $c.lastChild !== el) $c.appendChild(el);
}

// ── Move ───────────────────────────────────────────────
function _startMove(e, el, note) {
  e.preventDefault();
  // Use document-level listeners so pointerup always fires, even when
  // _bringToFront reappends el (which would silently drop pointer capture).
  const pid = e.pointerId;
  el.classList.add('note-card--drag');
  const sx = e.clientX, sy = e.clientY, nx = note.x, ny = note.y;

  const onMove = ev => {
    if (ev.pointerId !== pid) return;
    note.x = nx + (ev.clientX - sx) / _zoom;
    note.y = ny + (ev.clientY - sy) / _zoom;
    el.style.left = `${note.x}px`;
    el.style.top  = `${note.y}px`;
    _redrawConnections();
  };
  const onEnd = ev => {
    if (ev.pointerId !== pid) return;
    el.classList.remove('note-card--drag');
    document.removeEventListener('pointermove',   onMove);
    document.removeEventListener('pointerup',     onEnd);
    document.removeEventListener('pointercancel', onEnd);
    _persistNotes();
    _redrawConnections();
  };
  document.addEventListener('pointermove',   onMove);
  document.addEventListener('pointerup',     onEnd);
  document.addEventListener('pointercancel', onEnd);
}

// ── Resize ─────────────────────────────────────────────
function _startResize(e, el, note) {
  e.preventDefault();
  const pid = e.pointerId;
  const sx = e.clientX, sy = e.clientY, sw = note.w, sh = note.h;

  const onMove = ev => {
    if (ev.pointerId !== pid) return;
    note.w = Math.max(160, sw + (ev.clientX - sx) / _zoom);
    note.h = Math.max(130, sh + (ev.clientY - sy) / _zoom);
    el.style.width  = `${note.w}px`;
    el.style.height = `${note.h}px`;
    _redrawConnections();
  };
  const onEnd = ev => {
    if (ev.pointerId !== pid) return;
    document.removeEventListener('pointermove',   onMove);
    document.removeEventListener('pointerup',     onEnd);
    document.removeEventListener('pointercancel', onEnd);
    _persistNotes();
    _redrawConnections();
  };
  document.addEventListener('pointermove',   onMove);
  document.addEventListener('pointerup',     onEnd);
  document.addEventListener('pointercancel', onEnd);
}

// ── Color picker ───────────────────────────────────────
function _openPicker(el, note, $btn) {
  document.querySelectorAll('.nc-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'nc-picker';

  PASTEL_BG.forEach((bg, idx) => {
    const sw = document.createElement('button');
    sw.className = 'nc-picker-sw';
    sw.style.background  = bg;
    sw.style.borderColor = ACCENT_COLORS[idx];
    if (idx === note.color) sw.classList.add('active');
    // Stop pointerdown so the outside-click handler doesn't fire on swatches
    sw.addEventListener('pointerdown', e => e.stopPropagation());
    sw.addEventListener('click', ev => {
      ev.stopPropagation();
      note.color = idx;
      _applyCardStyle(el, note);
      _styleColorDot($btn, idx);
      _persistNotes();
      picker.remove();
    });
    picker.appendChild(sw);
  });

  document.body.appendChild(picker);
  const r = $btn.getBoundingClientRect();
  picker.style.left = `${Math.min(r.left, window.innerWidth - 230)}px`;
  picker.style.top  = `${r.bottom + 8}px`;

  // Close when clicking outside the picker
  setTimeout(() => {
    document.addEventListener('pointerdown', function closePicker(ev) {
      if (picker.contains(ev.target)) return;
      picker.remove();
      document.removeEventListener('pointerdown', closePicker);
    });
  }, 0);
}

// ── Connectors ─────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function _buildConnectorsSvg($canvas) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'notes-connectors');
  svg.setAttribute('width', '1');
  svg.setAttribute('height', '1');

  const defs = document.createElementNS(SVG_NS, 'defs');

  // Arrowhead marker (white fill + dark outline for visibility on any bg)
  const mkr = document.createElementNS(SVG_NS, 'marker');
  mkr.setAttribute('id', 'conn-arrow');
  mkr.setAttribute('viewBox', '0 0 12 12');
  mkr.setAttribute('refX', '10');
  mkr.setAttribute('refY', '6');
  mkr.setAttribute('markerWidth', '6');
  mkr.setAttribute('markerHeight', '6');
  mkr.setAttribute('orient', 'auto-start-reverse');
  const ap = document.createElementNS(SVG_NS, 'path');
  ap.setAttribute('d', 'M1 1 L11 6 L1 11 z');
  ap.setAttribute('fill', '#fff');
  ap.setAttribute('stroke', 'rgba(0,0,0,0.45)');
  ap.setAttribute('stroke-width', '1');
  ap.setAttribute('stroke-linejoin', 'round');
  mkr.appendChild(ap);
  defs.appendChild(mkr);

  svg.appendChild(defs);
  $canvas.appendChild(svg);
}

function _rectEdge(note, center, towards) {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  if (dx === 0 && dy === 0) return { x: center.x, y: center.y };
  const hw = note.w / 2, hh = note.h / 2;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const s = Math.min(ax === 0 ? Infinity : hw / ax, ay === 0 ? Infinity : hh / ay);
  return { x: center.x + dx * s, y: center.y + dy * s };
}

// Outward unit normal of the rectangle edge hit by the ray center→towards
function _rectEdgeNormal(note, center, towards) {
  const dx = towards.x - center.x;
  const dy = towards.y - center.y;
  if (dx === 0 && dy === 0) return { x: 1, y: 0 };
  const hw = note.w / 2, hh = note.h / 2;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const sx = ax === 0 ? Infinity : hw / ax;
  const sy = ay === 0 ? Infinity : hh / ay;
  return sx <= sy
    ? { x: dx > 0 ? 1 : -1, y: 0 }   // right / left edge
    : { x: 0, y: dy > 0 ? 1 : -1 };  // bottom / top edge
}

function _connPoints(conn) {
  const a = _notes.find(n => n.id === conn.fromId);
  const b = _notes.find(n => n.id === conn.toId);
  if (!a || !b) return null;
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const p1 = _rectEdge(a, ac, bc);
  const p2 = _rectEdge(b, bc, ac);
  const n1 = _rectEdgeNormal(a, ac, bc);
  const n2 = _rectEdgeNormal(b, bc, ac);

  // Tension: control points go outward along the edge normal
  const dist    = Math.max(80, Math.hypot(p2.x - p1.x, p2.y - p1.y));
  const tension = dist * 0.4;
  const cp1b = { x: p1.x + n1.x * tension, y: p1.y + n1.y * tension };
  const cp2b = { x: p2.x + n2.x * tension, y: p2.y + n2.y * tension };

  // Default handle position = bezier midpoint of the base curve
  const hx0 = (p1.x + 3 * cp1b.x + 3 * cp2b.x + p2.x) / 8;
  const hy0 = (p1.y + 3 * cp1b.y + 3 * cp2b.y + p2.y) / 8;

  // User bend: offset from the default handle position
  const bend = conn.bend ?? { dx: 0, dy: 0 };
  const cp1  = { x: cp1b.x + bend.dx, y: cp1b.y + bend.dy };
  const cp2  = { x: cp2b.x + bend.dx, y: cp2b.y + bend.dy };
  const handle = { x: hx0 + bend.dx, y: hy0 + bend.dy };

  return { p1, p2, cp1, cp2, handle, hx0, hy0 };
}

function _connPath(pts) {
  return `M ${pts.p1.x} ${pts.p1.y} C ${pts.cp1.x} ${pts.cp1.y} ${pts.cp2.x} ${pts.cp2.y} ${pts.p2.x} ${pts.p2.y}`;
}

function _redrawConnections() {
  const $canvas = document.getElementById('notesCanvas');
  const $svg = $canvas?.querySelector('.notes-connectors');
  if (!$svg) return;
  [...$svg.querySelectorAll('g.conn-group')].forEach(g => g.remove());

  _connections.forEach(c => {
    const pts = _connPoints(c);
    if (!pts) return;
    const d = _connPath(pts);

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'conn-group');
    g.dataset.cid = c.id;

    // Wide invisible hit zone so the curve is easy to click/tap
    const hit = document.createElementNS(SVG_NS, 'path');
    hit.setAttribute('class', 'conn-hit');
    hit.setAttribute('d', d);
    hit.addEventListener('pointerdown', ev => ev.stopPropagation()); // prevent canvas pan
    hit.addEventListener('click', ev => { ev.stopPropagation(); _openConnMenu(c, ev.clientX, ev.clientY); });
    g.appendChild(hit);

    // Main visible bezier path
    const mp = document.createElementNS(SVG_NS, 'path');
    mp.setAttribute('class', 'conn');
    mp.setAttribute('d', d);
    mp.setAttribute('marker-end', 'url(#conn-arrow)');
    if (c.mode === 'bidirectional') mp.setAttribute('marker-start', 'url(#conn-arrow)');
    g.appendChild(mp);

    // Single midpoint handle. Opacity driven by JS proximity.
    const hg = document.createElementNS(SVG_NS, 'g');
    hg.setAttribute('class', 'conn-handles');
    hg.style.opacity = '0';
    hg.appendChild(_connHandle(pts.handle, c));
    g.appendChild(hg);

    $svg.appendChild(g);
  });
}

// Partial in-place update for a single connection (used during handle drag)
function _updateConnGroup(conn) {
  const $canvas = document.getElementById('notesCanvas');
  const $g = $canvas?.querySelector(`.notes-connectors [data-cid="${conn.id}"]`);
  if (!$g) { _redrawConnections(); return; }
  const pts = _connPoints(conn);
  if (!pts) return;
  const d = _connPath(pts);
  $g.querySelectorAll('path.conn, path.conn-hit').forEach(p => p.setAttribute('d', d));
  const ci = $g.querySelector('circle.conn-cp');
  if (ci) { ci.setAttribute('cx', pts.handle.x); ci.setAttribute('cy', pts.handle.y); }
  const mp = $g.querySelector('path.conn');
  if (mp) {
    mp.setAttribute('marker-end', 'url(#conn-arrow)');
    if (conn.mode === 'bidirectional') mp.setAttribute('marker-start', 'url(#conn-arrow)');
    else mp.removeAttribute('marker-start');
  }
}

function _svgLine(p1, p2, cls) {
  const l = document.createElementNS(SVG_NS, 'line');
  l.setAttribute('class', cls);
  _setLine(l, p1, p2);
  return l;
}

function _setLine(el, p1, p2) {
  if (!el) return;
  el.setAttribute('x1', p1.x); el.setAttribute('y1', p1.y);
  el.setAttribute('x2', p2.x); el.setAttribute('y2', p2.y);
}

function _connHandle(handle, conn) {
  const ci = document.createElementNS(SVG_NS, 'circle');
  ci.setAttribute('class', 'conn-cp');
  ci.setAttribute('cx', handle.x);
  ci.setAttribute('cy', handle.y);
  ci.setAttribute('r', '9');

  ci.addEventListener('pointerdown', e => {
    e.stopPropagation();
    ci.setPointerCapture(e.pointerId);
    const $wrap = document.getElementById('notesCanvasWrap');

    const onMove = ev => {
      const r  = $wrap.getBoundingClientRect();
      const wx = (ev.clientX - r.left - _panX) / _zoom;
      const wy = (ev.clientY - r.top  - _panY) / _zoom;
      // Compute base handle position (bend=0) to store offset
      const base = _connPoints({ ...conn, bend: null });
      conn.bend = base ? { dx: wx - base.hx0, dy: wy - base.hy0 } : { dx: wx, dy: wy };
      _updateConnGroup(conn);
    };
    const onEnd = () => {
      ci.removeEventListener('pointermove',   onMove);
      ci.removeEventListener('pointerup',     onEnd);
      ci.removeEventListener('pointercancel', onEnd);
      _persistConnections();
    };
    ci.addEventListener('pointermove',   onMove);
    ci.addEventListener('pointerup',     onEnd);
    ci.addEventListener('pointercancel', onEnd);
  });
  ci.addEventListener('click', e => e.stopPropagation());
  return ci;
}

// ── Handle proximity (distance-based opacity) ──────────
function _bezierMinDist({ p1, cp1, cp2, p2 }, px, py) {
  let min = Infinity;
  for (let i = 0; i <= 14; i++) {
    const t  = i / 14;
    const m  = 1 - t;
    const bx = m*m*m*p1.x + 3*m*m*t*cp1.x + 3*m*t*t*cp2.x + t*t*t*p2.x;
    const by = m*m*m*p1.y + 3*m*m*t*cp1.y + 3*m*t*t*cp2.y + t*t*t*p2.y;
    const d  = Math.hypot(px - bx, py - by);
    if (d < min) min = d;
  }
  return min;
}

function _updateHandleProximity(clientX, clientY) {
  const $wrap = document.getElementById('notesCanvasWrap');
  if (!$wrap) return;
  const r      = $wrap.getBoundingClientRect();
  const px     = (clientX - r.left - _panX) / _zoom;
  const py     = (clientY - r.top  - _panY) / _zoom;
  const thresh = 120 / _zoom;   // 120 screen-px equivalent in world units
  const $canvas = document.getElementById('notesCanvas');
  if (!$canvas) return;

  _connections.forEach(c => {
    const pts = _connPoints(c);
    if (!pts) return;
    const dist    = _bezierMinDist(pts, px, py);
    const opacity = Math.max(0, 1 - dist / thresh);
    const $h = $canvas.querySelector(`.conn-group[data-cid="${c.id}"] .conn-handles`);
    if ($h) $h.style.opacity = opacity;
  });
}

function _startConnDrag(e, fromNote) {
  e.preventDefault();
  const pid     = e.pointerId;
  const $canvas = document.getElementById('notesCanvas');
  const $wrap   = document.getElementById('notesCanvasWrap');
  const $svg    = $canvas.querySelector('.notes-connectors');
  if (!$svg) return;

  const fx = fromNote.x + fromNote.w / 2;
  const fy = fromNote.y + fromNote.h / 2;

  const pend = document.createElementNS(SVG_NS, 'line');
  pend.setAttribute('class', 'conn-pending');
  pend.setAttribute('x1', fx); pend.setAttribute('y1', fy);
  pend.setAttribute('x2', fx); pend.setAttribute('y2', fy);
  pend.setAttribute('marker-end', 'url(#conn-arrow)');
  $svg.appendChild(pend);

  const toWorld = (cx, cy) => {
    const r = $wrap.getBoundingClientRect();
    return { x: (cx - r.left - _panX) / _zoom, y: (cy - r.top - _panY) / _zoom };
  };

  const onMove = ev => {
    if (ev.pointerId !== pid) return;
    const p = toWorld(ev.clientX, ev.clientY);
    pend.setAttribute('x2', p.x);
    pend.setAttribute('y2', p.y);
  };

  const onUp = ev => {
    if (ev.pointerId !== pid) return;
    document.removeEventListener('pointermove',   onMove);
    document.removeEventListener('pointerup',     onUp);
    document.removeEventListener('pointercancel', onUp);
    pend.remove();

    const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.note-card');
    if (!hit) return;
    const toId = hit.dataset.nid;
    if (!toId || toId === fromNote.id) return;
    if (_connections.some(c =>
      (c.fromId === fromNote.id && c.toId === toId) ||
      (c.fromId === toId && c.toId === fromNote.id))) return;

    _connections.push({ id: uid(), fromId: fromNote.id, toId, mode: 'oriented' });
    _persistConnections();
    _redrawConnections();
  };

  document.addEventListener('pointermove',   onMove);
  document.addEventListener('pointerup',     onUp);
  document.addEventListener('pointercancel', onUp);
}

function _openConnMenu(conn, clientX, clientY) {
  document.querySelectorAll('.conn-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'conn-menu';
  menu.innerHTML = `
    <button data-act="toggle">${conn.mode === 'bidirectional' ? 'Rendi orientata' : 'Rendi bidirezionale'}</button>
    <button data-act="reverse">Inverti direzione</button>
    <button data-act="delete">Elimina connessione</button>
  `;
  menu.addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (!act) return;
    if (act === 'toggle') {
      conn.mode = conn.mode === 'bidirectional' ? 'oriented' : 'bidirectional';
      _updateConnGroup(conn);
    } else if (act === 'reverse') {
      const t = conn.fromId; conn.fromId = conn.toId; conn.toId = t;
      _redrawConnections();
    } else if (act === 'delete') {
      _connections = _connections.filter(c => c.id !== conn.id);
      _redrawConnections();
    }
    _persistConnections();
    menu.remove();
  });

  document.body.appendChild(menu);
  const mw = menu.offsetWidth || 200, mh = menu.offsetHeight || 120;
  menu.style.left = `${Math.min(clientX, window.innerWidth  - mw - 8)}px`;
  menu.style.top  = `${Math.min(clientY + 8, window.innerHeight - mh - 8)}px`;

  setTimeout(() => {
    document.addEventListener('pointerdown', function close(ev) {
      if (menu.contains(ev.target)) return;
      menu.remove();
      document.removeEventListener('pointerdown', close);
    });
  }, 0);
}
