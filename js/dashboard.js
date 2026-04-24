'use strict';

const TILES_KEY = 'tiles_order';

const TILE_DEFS = {
  todo:   { label: 'Todo',    sub: () => _todoSubtitle(),   icon: 'tileCheck',  accent: 3, view: 'todo' },
  postit: { label: 'Post-it', sub: () => _postitSubtitle(), icon: 'tilePostit', accent: 5, view: 'notes' },
  notes:  { label: 'Note',    sub: () => 'Prossimamente',   icon: 'tileNotes',  accent: 1, view: null },
};

function _todoSubtitle() {
  const todos = getTodos();
  if (!todos.length) return 'Nessun appunto';
  const done  = todos.filter(t => t.done).length;
  const pend  = todos.length - done;
  if (done === todos.length) return `Tutti completati · ${todos.length}`;
  return `${pend} da fare · ${done} completati`;
}

function _postitSubtitle() {
  try {
    const notes = JSON.parse(localStorage.getItem('dnotes_' + dateKey(state.currentDate))) || [];
    if (!notes.length) return 'Nessun post-it';
    const withText = notes.filter(n => n.body && n.body.trim()).length;
    return withText
      ? `${notes.length} post-it · ${withText} con testo`
      : `${notes.length} post-it`;
  } catch (_) { return 'Nessun post-it'; }
}

function _loadTileOrder() {
  try {
    const s    = JSON.parse(localStorage.getItem(TILES_KEY));
    const keys = Object.keys(TILE_DEFS);
    if (Array.isArray(s) && s.every(id => TILE_DEFS[id]) && keys.every(id => s.includes(id))) return s;
  } catch (_) {}
  return Object.keys(TILE_DEFS);
}

function _saveTileOrder(order) {
  localStorage.setItem(TILES_KEY, JSON.stringify(order));
}

// ── Render ─────────────────────────────────────────────

function renderDashboard() {
  const $grid = document.getElementById('dashboardGrid');
  if (!$grid) return;
  const order = _loadTileOrder();
  $grid.innerHTML = '';

  order.forEach((id, idx) => {
    const def = TILE_DEFS[id];
    if (!def) return;

    const tile = document.createElement('div');
    tile.className = 'dash-tile';
    tile.dataset.tileId  = id;
    tile.dataset.tileIdx = String(idx);
    tile.style.setProperty('--tile-accent',       ACCENT_COLORS[def.accent]);
    tile.style.setProperty('--tile-accent-light', ACCENT_LIGHT[def.accent]);
    tile.style.setProperty('--tile-bg',           PASTEL_BG[def.accent]);

    tile.innerHTML = `
      <div class="dash-tile-icon">${SVG[def.icon]}</div>
      <div class="dash-tile-label">${def.label}</div>
      <div class="dash-tile-sub">${def.sub()}</div>
    `;

    tile.addEventListener('pointerdown', _onPointerDown);
    $grid.appendChild(tile);
  });
}

// ── Pointer drag state ─────────────────────────────────

let _drag = null;

function _onPointerDown(e) {
  if (e.button !== 0) return;
  if (_drag) return; // block new drag while landing animation is running
  e.preventDefault();

  const tile = this;
  tile.setPointerCapture(e.pointerId);

  const $grid = document.getElementById('dashboardGrid');
  const tiles = [...$grid.querySelectorAll('.dash-tile')];

  // Reset any lingering transforms and capture original slot rects
  tiles.forEach(t => { t.style.transition = 'none'; t.style.transform = ''; });
  const slotRects = tiles.map(t => {
    const r = t.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });

  const srcIdx = parseInt(tile.dataset.tileIdx, 10);
  const sr     = slotRects[srcIdx];

  // Floating clone that follows the pointer
  const clone = tile.cloneNode(true);
  Object.assign(clone.style, {
    position:      'fixed',
    left:          `${sr.left}px`,
    top:           `${sr.top}px`,
    width:         `${sr.width}px`,
    height:        `${sr.height}px`,
    margin:        '0',
    zIndex:        '2000',
    pointerEvents: 'none',
    borderRadius:  '24px',
    willChange:    'left, top',
    transition:    'transform 0.15s ease, box-shadow 0.15s ease',
    transform:     'scale(1.07)',
    boxShadow:     '0 28px 64px rgba(0,0,0,0.45)',
  });
  document.body.appendChild(clone);

  tile.classList.add('dash-tile--ghost');

  _drag = {
    tile,
    clone,
    srcIdx,
    slotRects,
    nearestIdx:  srcIdx,
    currentOrder: [..._loadTileOrder()],
    ox: e.clientX - sr.left,
    oy: e.clientY - sr.top,
    moved: false,
  };

  tile.addEventListener('pointermove',   _onPointerMove);
  tile.addEventListener('pointerup',     _onPointerUp);
  tile.addEventListener('pointercancel', _onPointerUp);
}

function _onPointerMove(e) {
  if (!_drag) return;

  const { clone, slotRects, srcIdx, ox, oy, tile } = _drag;

  const x = e.clientX - ox;
  const y = e.clientY - oy;

  // Only start "drag mode" after 8px of movement
  if (!_drag.moved) {
    const dx = e.clientX - (slotRects[srcIdx].left + ox);
    const dy = e.clientY - (slotRects[srcIdx].top  + oy);
    if (Math.hypot(dx, dy) < 8) return;
    _drag.moved = true;
  }

  clone.style.left = `${x}px`;
  clone.style.top  = `${y}px`;

  // Center of the floating tile
  const cx = x + slotRects[srcIdx].width  / 2;
  const cy = y + slotRects[srcIdx].height / 2;

  // Find the nearest original slot
  let nearestIdx = srcIdx;
  let minDist    = Infinity;
  slotRects.forEach((r, i) => {
    const d = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2));
    if (d < minDist) { minDist = d; nearestIdx = i; }
  });

  if (nearestIdx === _drag.nearestIdx) return;
  _drag.nearestIdx = nearestIdx;

  // Recompute conceptual order
  const base = _loadTileOrder();
  const newOrder = [...base];
  const [moved] = newOrder.splice(srcIdx, 1);
  newOrder.splice(nearestIdx, 0, moved);
  _drag.currentOrder = newOrder;

  // Translate other tiles to their new slots
  const $grid = document.getElementById('dashboardGrid');
  [...$grid.querySelectorAll('.dash-tile')].forEach((t, domIdx) => {
    if (t === tile) return;
    const targetIdx = newOrder.indexOf(t.dataset.tileId);
    const tr = slotRects[targetIdx];
    const cr = slotRects[domIdx];
    t.style.transition = 'transform 0.24s cubic-bezier(0.25,0.46,0.45,0.94)';
    t.style.transform  = `translate(${tr.left - cr.left}px, ${tr.top - cr.top}px)`;
  });
}

function _onPointerUp() {
  if (!_drag) return;

  const { tile, clone, currentOrder, slotRects, moved } = _drag;

  tile.removeEventListener('pointermove',   _onPointerMove);
  tile.removeEventListener('pointerup',     _onPointerUp);
  tile.removeEventListener('pointercancel', _onPointerUp);

  if (!moved) {
    // Tap: clean up and navigate
    clone.remove();
    tile.classList.remove('dash-tile--ghost');
    _drag = null;
    const def = TILE_DEFS[tile.dataset.tileId];
    if (def && def.view) navigateTo(def.view);
    return;
  }

  // Animate clone landing on its final slot
  const finalIdx = currentOrder.indexOf(tile.dataset.tileId);
  const fr       = slotRects[finalIdx];

  clone.style.transition = 'left 0.22s ease, top 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease';
  clone.style.left       = `${fr.left}px`;
  clone.style.top        = `${fr.top}px`;
  clone.style.transform  = 'scale(1)';
  clone.style.boxShadow  = '0 4px 20px rgba(0,0,0,0.15)';

  const thisDrag = _drag;
  setTimeout(() => {
    clone.remove();
    if (_drag === thisDrag) {
      _drag = null;
      _saveTileOrder(currentOrder);
      renderDashboard();
    }
  }, 220);
}
