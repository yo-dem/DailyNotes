'use strict';

const NOTES_STORE = 'dnotes_';
const DOT_SIZE    = 26;
const ZOOM_MIN    = 0.25;
const ZOOM_MAX    = 3;
const ZOOM_STEP   = 0.15;

let _notes         = [];
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

// ── Public ─────────────────────────────────────────────
function renderNotes() {
  _loadNotes();
  _panX = 0; _panY = 0; _zoom = 1;
  const $canvas = document.getElementById('notesCanvas');
  if (!$canvas) return;
  $canvas.innerHTML = '';
  _notes.forEach(n => _buildNoteCard(n, $canvas));
  _applyTransform();
  if (!_panInited) { _initInteraction(); _panInited = true; }
}

function addNote() {
  const step = _notes.length % 6;
  const x = (80 + step * 28 - _panX) / _zoom;
  const y = (80 + step * 28 - _panY) / _zoom;
  const note = { id: uid(), title: '', body: '', x, y, w: 220, h: 200, color: 0 };
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
    if (e.target.closest('.note-card') || e.target.closest('.notes-zoom-bar')) return;
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

  $title.addEventListener('input', () => { note.title = $title.value; _persistNotes(); });
  $body.addEventListener('input',  () => { note.body  = $body.value;  _persistNotes(); });

  // Stop canvas pan on card touch, bring card to front
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    _bringToFront(el);
  });

  // Drag from header bar
  $top.addEventListener('pointerdown', e => {
    if (e.target === $title || e.target.closest('.nc-color') || e.target.closest('.nc-del')) return;
    _startMove(e, el, note);
  });

  // Color picker — stop pointerdown so it doesn't close itself
  $color.addEventListener('pointerdown', e => e.stopPropagation());
  $color.addEventListener('click',       e => { e.stopPropagation(); _openPicker(el, note, $color); });

  // Delete
  $del.addEventListener('pointerdown', e => e.stopPropagation());
  $del.addEventListener('click', e => {
    e.stopPropagation();
    _notes = _notes.filter(n => n.id !== note.id);
    _persistNotes();
    el.remove();
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
  el.setPointerCapture(e.pointerId);
  el.classList.add('note-card--drag');
  const sx = e.clientX, sy = e.clientY, nx = note.x, ny = note.y;

  function onMove(ev) {
    note.x = nx + (ev.clientX - sx) / _zoom;
    note.y = ny + (ev.clientY - sy) / _zoom;
    el.style.left = `${note.x}px`;
    el.style.top  = `${note.y}px`;
  }
  function onUp() {
    el.classList.remove('note-card--drag');
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup',   onUp);
    _persistNotes();
  }
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup',   onUp);
}

// ── Resize ─────────────────────────────────────────────
function _startResize(e, el, note) {
  e.preventDefault();
  const $g = el.querySelector('.nc-grip');
  $g.setPointerCapture(e.pointerId);
  const sx = e.clientX, sy = e.clientY, sw = note.w, sh = note.h;

  function onMove(ev) {
    note.w = Math.max(160, sw + (ev.clientX - sx) / _zoom);
    note.h = Math.max(130, sh + (ev.clientY - sy) / _zoom);
    el.style.width  = `${note.w}px`;
    el.style.height = `${note.h}px`;
  }
  function onUp() {
    $g.removeEventListener('pointermove', onMove);
    $g.removeEventListener('pointerup',   onUp);
    _persistNotes();
  }
  $g.addEventListener('pointermove', onMove);
  $g.addEventListener('pointerup',   onUp);
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
