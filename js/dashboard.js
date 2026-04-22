'use strict';

const TILES_KEY = 'tiles_order';

const TILE_DEFS = {
  todo:  { label: 'Todo',  sub: () => _todoSubtitle(), icon: 'tileCheck', accent: 3 },
  notes: { label: 'Note',  sub: () => 'Prossimamente', icon: 'tileNotes', accent: 1 },
};

function _todoSubtitle() {
  const todos = getTodos();
  if (!todos.length) return 'Nessun appunto';
  const done = todos.filter(t => t.done).length;
  return `${done} / ${todos.length} completati`;
}

function _loadTileOrder() {
  try {
    const s = JSON.parse(localStorage.getItem(TILES_KEY));
    if (Array.isArray(s) && s.every(id => TILE_DEFS[id])) return s;
  } catch (_) {}
  return Object.keys(TILE_DEFS);
}

function _saveTileOrder(order) {
  localStorage.setItem(TILES_KEY, JSON.stringify(order));
}

let _tileDragSrc = null;

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
    tile.draggable = true;

    tile.innerHTML = `
      <div class="dash-tile-icon">${SVG[def.icon]}</div>
      <div class="dash-tile-label">${def.label}</div>
      <div class="dash-tile-sub">${def.sub()}</div>
    `;

    tile.addEventListener('click',     () => navigateTo(id));
    tile.addEventListener('dragstart', _tileDragStart);
    tile.addEventListener('dragover',  _tileDragOver);
    tile.addEventListener('drop',      _tileDrop);
    tile.addEventListener('dragend',   _tileDragEnd);
    tile.addEventListener('dragleave', e => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
      }
    });

    $grid.appendChild(tile);
  });
}

function _tileDragStart(e) {
  _tileDragSrc = parseInt(this.dataset.tileIdx, 10);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function _tileDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.dash-tile').forEach(t => t.classList.remove('drag-over'));
  if (parseInt(this.dataset.tileIdx, 10) !== _tileDragSrc) {
    this.classList.add('drag-over');
  }
}

function _tileDrop(e) {
  e.preventDefault();
  const dest = parseInt(this.dataset.tileIdx, 10);
  if (_tileDragSrc === null || _tileDragSrc === dest) return;
  const order = _loadTileOrder();
  const [moved] = order.splice(_tileDragSrc, 1);
  order.splice(dest, 0, moved);
  _saveTileOrder(order);
  renderDashboard();
}

function _tileDragEnd() {
  document.querySelectorAll('.dash-tile').forEach(t => t.classList.remove('dragging', 'drag-over'));
  _tileDragSrc = null;
}
