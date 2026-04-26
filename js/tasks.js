'use strict';

const KANBAN_KEY      = 'kanban_board';
const KANBAN_COLS_KEY = 'kanban_cols';
const KANBAN_TAGS_KEY = 'kanban_tags';
const TASK_COLORS     = ['#7B1FA2','#0288D1','#E65100','#2E7D32','#C2185B','#F57F17'];

const _DEFAULT_COLS = [
  { id: 'todo',  label: 'To Do', color: '#0288D1' },
  { id: 'doing', label: 'Doing', color: '#E65100' },
  { id: 'done',  label: 'Done',  color: '#2E7D32' },
];

// ── Storage ──────────────────────────────────────────────
function loadKanban() {
  try {
    const raw = localStorage.getItem(KANBAN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function _saveKanban(tasks) {
  localStorage.setItem(KANBAN_KEY, JSON.stringify(tasks));
}

function loadCols() {
  try {
    const raw = localStorage.getItem(KANBAN_COLS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return _DEFAULT_COLS.map(c => ({ ...c }));
}

function _saveCols(cols) {
  localStorage.setItem(KANBAN_COLS_KEY, JSON.stringify(cols));
}

function loadTags() {
  try {
    const raw = localStorage.getItem(KANBAN_TAGS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function _saveTags(tags) {
  localStorage.setItem(KANBAN_TAGS_KEY, JSON.stringify(tags));
}

// ── Tag colour (repo lookup, fallback to hash) ───────────
function _tagColor(tagName) {
  const found = loadTags().find(t => t.name === tagName);
  if (found) return found.color;
  let h = 0;
  for (let i = 0; i < tagName.length; i++) h = (h * 31 + tagName.charCodeAt(i)) >>> 0;
  return TASK_COLORS[h % TASK_COLORS.length];
}

// ── Modal state ──────────────────────────────────────────
let _editingId    = null;
let _editingCol   = 'todo';
let _editingTags  = [];
let _editingColor = TASK_COLORS[1];
let _newTagColor  = TASK_COLORS[0];

// ── Drag state ───────────────────────────────────────────
let _dragId  = null;   // card drag (HTML5)
let _colDrag = null;   // column drag (pointer)

// ── Render ───────────────────────────────────────────────
function renderKanban() {
  const $board = document.getElementById('kanbanBoard');
  if (!$board) return;

  const cols  = loadCols();
  const tasks = loadKanban();

  $board.innerHTML = '';

  cols.forEach(col => {
    const colEl = document.createElement('div');
    colEl.className  = 'kanban-col';
    colEl.dataset.col = col.id;

    const header = document.createElement('div');
    header.className = 'kanban-col-header';
    header.innerHTML = `
      <span class="kanban-col-grip" title="Trascina sezione">⠿</span>
      <span class="kanban-col-dot" style="background:${col.color}"></span>
      <span class="kanban-col-title" contenteditable="true" spellcheck="false">${escHtml(col.label)}</span>
      <button class="kanban-del-btn" title="Elimina sezione">×</button>
    `;
    colEl.appendChild(header);

    const cardsEl = document.createElement('div');
    cardsEl.className  = 'kanban-cards';
    cardsEl.dataset.col = col.id;
    colEl.appendChild(cardsEl);

    const footer = document.createElement('div');
    footer.className = 'kanban-col-footer';
    footer.innerHTML = `<button class="kanban-add-btn" title="Aggiungi task">+ Aggiungi task</button>`;
    colEl.appendChild(footer);

    tasks.filter(t => t.col === col.id)
         .forEach(t => cardsEl.appendChild(_buildKanbanCard(t, cols)));

    // Title inline editing
    const titleEl = header.querySelector('.kanban-col-title');
    titleEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
    });
    titleEl.addEventListener('blur', () => {
      const newLabel = titleEl.textContent.trim() || col.label;
      titleEl.textContent = newLabel;
      const saved = loadCols();
      const c = saved.find(x => x.id === col.id);
      if (c && c.label !== newLabel) { c.label = newLabel; _saveCols(saved); }
    });

    // Add-task button (footer) — creates immediately, no modal
    footer.querySelector('.kanban-add-btn').addEventListener('click', () => {
      const all = loadKanban();
      all.push({ id: uid(), col: col.id, title: '', body: '', tags: [], color: TASK_COLORS[1] });
      _saveKanban(all);
      renderKanban();
    });

    // Delete column button
    header.querySelector('.kanban-del-btn').addEventListener('click', () => {
      const cardCount = loadKanban().filter(t => t.col === col.id).length;
      const msg = cardCount
        ? `La sezione "${col.label}" e ${cardCount === 1 ? 'il task al suo interno' : `i ${cardCount} task al suo interno`} verranno eliminati definitivamente.`
        : `La sezione "${col.label}" verrà eliminata definitivamente.`;
      showConfirm({
        title: 'Eliminare sezione?',
        message: msg,
        confirmLabel: 'Elimina',
        danger: true,
        onConfirm: () => {
          _saveCols(loadCols().filter(c => c.id !== col.id));
          _saveKanban(loadKanban().filter(t => t.col !== col.id));
          renderKanban();
        },
      });
    });

    // Column drag handle
    header.querySelector('.kanban-col-grip').addEventListener('pointerdown', _onColPointerDown);

    // Card drop zone
    cardsEl.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cardsEl.classList.add('drag-over');
    });
    cardsEl.addEventListener('dragleave', e => {
      if (!cardsEl.contains(e.relatedTarget)) cardsEl.classList.remove('drag-over');
    });
    cardsEl.addEventListener('drop', e => {
      e.preventDefault();
      cardsEl.classList.remove('drag-over');
      if (!_dragId) return;
      const all = loadKanban();
      const t   = all.find(x => x.id === _dragId);
      if (t && t.col !== col.id) { t.col = col.id; _saveKanban(all); renderKanban(); }
    });

    $board.appendChild(colEl);
  });
}

// ── Card builder ─────────────────────────────────────────
function _buildKanbanCard(task, cols) {
  if (!cols) cols = loadCols();
  const colIdx = cols.findIndex(c => c.id === task.col);
  const color  = task.color || TASK_COLORS[1];

  const card = document.createElement('div');
  card.className  = 'kcard';
  card.dataset.id = task.id;
  card.draggable  = true;

  const tagsHtml = (task.tags || [])
    .map(t => `<span class="kcard-tag" style="background:${_tagColor(t)}">${escHtml(t)}</span>`)
    .join('');

  card.innerHTML = `
    <button class="kcard-del" title="Elimina">×</button>
    <div class="kcard-stripe" style="background:${color}"></div>
    <div class="kcard-content">
      <div class="kcard-title">${escHtml(task.title || 'Senza titolo')}</div>
      ${tagsHtml ? `<div class="kcard-tags">${tagsHtml}</div>` : ''}
      ${task.body ? `<div class="kcard-desc">${escHtml(task.body)}</div>` : ''}
    </div>
    <div class="kcard-actions">
      <button class="kcard-mv" data-dir="-1" ${colIdx <= 0 ? 'disabled' : ''} title="Colonna precedente">←</button>
      <button class="kcard-mv" data-dir="1"  ${colIdx >= cols.length - 1 ? 'disabled' : ''} title="Colonna successiva">→</button>
    </div>
  `;

  // Double-click → edit
  card.addEventListener('dblclick', e => {
    if (e.target.closest('.kcard-del, .kcard-mv')) return;
    _openModal(task.id);
  });

  card.querySelector('.kcard-del').addEventListener('click', e => {
    e.stopPropagation();
    showConfirm({
      title: 'Eliminare task?',
      message: `"${escHtml(task.title || 'Senza titolo')}" verrà rimosso definitivamente.`,
      confirmLabel: 'Elimina',
      danger: true,
      onConfirm: () => {
        _saveKanban(loadKanban().filter(t => t.id !== task.id));
        renderKanban();
      },
    });
  });

  card.querySelectorAll('.kcard-mv').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const cs = loadCols();
      const ci = cs.findIndex(c => c.id === task.col);
      const ni = ci + parseInt(btn.dataset.dir);
      if (ni < 0 || ni >= cs.length) return;
      const all = loadKanban();
      const t   = all.find(x => x.id === task.id);
      if (t) { t.col = cs[ni].id; _saveKanban(all); renderKanban(); }
    });
  });

  card.addEventListener('dragstart', e => {
    _dragId = task.id;
    requestAnimationFrame(() => card.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    _dragId = null;
    document.querySelectorAll('.kanban-cards').forEach(c => c.classList.remove('drag-over'));
  });

  return card;
}

// ── Column drag (pointer-based) ──────────────────────────
function _onColPointerDown(e) {
  if (e.button !== 0) return;
  if (_colDrag) return;
  e.preventDefault();

  const col    = e.currentTarget.closest('.kanban-col');
  const $board = document.getElementById('kanbanBoard');
  const colEls = [...$board.querySelectorAll('.kanban-col')];

  colEls.forEach(c => { c.style.transition = 'none'; c.style.transform = ''; });
  const slotRects = colEls.map(c => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });

  const srcIdx = colEls.indexOf(col);
  const sr     = slotRects[srcIdx];

  const clone = col.cloneNode(true);
  Object.assign(clone.style, {
    position:      'fixed',
    left:          `${sr.left}px`,
    top:           `${sr.top}px`,
    width:         `${sr.width}px`,
    height:        `${sr.height}px`,
    margin:        '0',
    zIndex:        '2000',
    pointerEvents: 'none',
    transition:    'transform 0.15s ease, box-shadow 0.15s ease',
    transform:     'scale(1.02)',
    boxShadow:     '0 24px 64px rgba(0,0,0,0.5)',
    opacity:       '0.96',
    borderRadius:  '20px',
  });
  document.body.appendChild(clone);
  col.classList.add('kanban-col--ghost');

  _colDrag = {
    col,
    clone,
    srcIdx,
    slotRects,
    nearestIdx:   srcIdx,
    currentOrder: loadCols().map(c => c.id),
    ox: e.clientX - sr.left,
    oy: e.clientY - sr.top,
    moved: false,
  };

  document.addEventListener('pointermove',   _onColPointerMove);
  document.addEventListener('pointerup',     _onColPointerUp);
  document.addEventListener('pointercancel', _onColPointerUp);
}

function _onColPointerMove(e) {
  if (!_colDrag) return;
  const { clone, slotRects, srcIdx, ox, oy, col } = _colDrag;

  const x = e.clientX - ox;
  const y = e.clientY - oy;

  if (!_colDrag.moved) {
    const dx = e.clientX - (slotRects[srcIdx].left + ox);
    const dy = e.clientY - (slotRects[srcIdx].top  + oy);
    if (Math.hypot(dx, dy) < 8) return;
    _colDrag.moved = true;
  }

  clone.style.left = `${x}px`;
  clone.style.top  = `${y}px`;

  const cx = x + slotRects[srcIdx].width / 2;

  let nearestIdx = srcIdx;
  let minDist    = Infinity;
  slotRects.forEach((r, i) => {
    const d = Math.abs(cx - (r.left + r.width / 2));
    if (d < minDist) { minDist = d; nearestIdx = i; }
  });

  if (nearestIdx === _colDrag.nearestIdx) return;
  _colDrag.nearestIdx = nearestIdx;

  const ids      = loadCols().map(c => c.id);
  const newOrder = [...ids];
  const [moved]  = newOrder.splice(srcIdx, 1);
  newOrder.splice(nearestIdx, 0, moved);
  _colDrag.currentOrder = newOrder;

  const $board = document.getElementById('kanbanBoard');
  [...$board.querySelectorAll('.kanban-col')].forEach((c, domIdx) => {
    if (c === col) return;
    const targetIdx = newOrder.indexOf(c.dataset.col);
    const tr = slotRects[targetIdx];
    const cr = slotRects[domIdx];
    c.style.transition = 'transform 0.24s cubic-bezier(0.25,0.46,0.45,0.94)';
    c.style.transform  = `translateX(${tr.left - cr.left}px)`;
  });
}

function _onColPointerUp() {
  if (!_colDrag) return;

  const { col, clone, currentOrder, slotRects, moved } = _colDrag;

  document.removeEventListener('pointermove',   _onColPointerMove);
  document.removeEventListener('pointerup',     _onColPointerUp);
  document.removeEventListener('pointercancel', _onColPointerUp);

  _colDrag = null;

  if (!moved) {
    clone.remove();
    col.classList.remove('kanban-col--ghost');
    return;
  }

  // Land clone on its final slot
  const colId      = col.dataset.col;
  const finalIdx   = currentOrder.indexOf(colId);
  const fr         = slotRects[finalIdx];

  clone.style.transition = 'left 0.22s ease, top 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease';
  clone.style.left       = `${fr.left}px`;
  clone.style.top        = `${fr.top}px`;
  clone.style.transform  = 'scale(1)';
  clone.style.boxShadow  = '0 4px 20px rgba(0,0,0,0.18)';

  const savedCols = loadCols();
  const newCols   = currentOrder.map(id => savedCols.find(c => c.id === id)).filter(Boolean);
  _saveCols(newCols);

  setTimeout(() => {
    try { clone.remove(); } catch {}
    renderKanban();
  }, 220);
}

// ── Add new column (FAB in task view) ────────────────────
function addKanbanColumn() {
  const cols   = loadCols();
  const colors = ['#0288D1','#E65100','#2E7D32','#7B1FA2','#C2185B','#F57F17'];
  const color  = colors[cols.length % colors.length];
  cols.push({ id: uid(), label: 'Nuova sezione', color });
  _saveCols(cols);
  renderKanban();

  const $board = document.getElementById('kanbanBoard');
  const last   = $board?.lastElementChild;
  if (last) {
    const titleEl = last.querySelector('.kanban-col-title');
    if (titleEl) {
      setTimeout(() => {
        titleEl.focus();
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }, 40);
    }
  }
}

// ── Modal ────────────────────────────────────────────────
function _openModal(taskId, col) {
  const task    = taskId ? loadKanban().find(t => t.id === taskId) : null;
  _editingId    = taskId || null;
  _editingCol   = col || task?.col || loadCols()[0]?.id || 'todo';
  _editingTags  = task ? [...(task.tags || [])] : [];
  _editingColor = task?.color || TASK_COLORS[1];
  _newTagColor  = TASK_COLORS[0];

  document.getElementById('tmTitle').value    = task?.title || '';
  document.getElementById('tmBody').value     = task?.body  || '';
  document.getElementById('tmTagInput').value = '';
  document.getElementById('tmDelete').classList.toggle('hidden', !taskId);

  _renderTmTags();
  _renderTmColors();
  _renderTmTagColors();
  _renderTagRepo();
  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('tmTitle').focus();
}

function _closeModal() {
  document.getElementById('taskModal').classList.add('hidden');
}

function _renderTmTags() {
  const list = document.getElementById('tmTagList');
  list.innerHTML = '';
  _editingTags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = 'tm-chip';
    chip.style.background = _tagColor(tag);
    chip.innerHTML = `${escHtml(tag)}<button class="tm-chip-del" type="button">×</button>`;
    chip.querySelector('.tm-chip-del').addEventListener('pointerdown', e => {
      e.preventDefault();
      _editingTags.splice(i, 1);
      _renderTmTags();
      _renderTagRepo();
    });
    list.appendChild(chip);
  });
}

function _renderTmColors() {
  const wrap = document.getElementById('tmColors');
  wrap.innerHTML = '';
  TASK_COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'tm-color-dot' + (c === _editingColor ? ' tm-color-dot--sel' : '');
    btn.style.background = c;
    btn.addEventListener('click', () => { _editingColor = c; _renderTmColors(); });
    wrap.appendChild(btn);
  });
}

function _renderTmTagColors() {
  const wrap = document.getElementById('tmTagColors');
  if (!wrap) return;
  wrap.innerHTML = '';
  TASK_COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'tm-tc-dot' + (c === _newTagColor ? ' tm-tc-dot--sel' : '');
    btn.style.background = c;
    btn.addEventListener('click', () => { _newTagColor = c; _renderTmTagColors(); });
    wrap.appendChild(btn);
  });
}

function _renderTagRepo() {
  const wrap = document.getElementById('tmTagRepo');
  if (!wrap) return;
  wrap.innerHTML = '';
  loadTags().filter(t => !_editingTags.includes(t.name)).forEach(tagObj => {
    const chip = document.createElement('span');
    chip.className = 'tm-repo-chip' + (_editingTags.includes(tagObj.name) ? ' tm-repo-chip--active' : '');
    chip.style.setProperty('--chip-color', tagObj.color);

    const label = document.createElement('span');
    label.className   = 'tm-repo-chip-label';
    label.textContent = tagObj.name;
    label.addEventListener('click', () => {
      if (_editingTags.includes(tagObj.name)) {
        _editingTags = _editingTags.filter(t => t !== tagObj.name);
      } else {
        _editingTags.push(tagObj.name);
      }
      _renderTmTags();
      _renderTagRepo();
    });

    const del = document.createElement('button');
    del.type      = 'button';
    del.className = 'tm-repo-chip-del';
    del.textContent = '×';
    del.title = 'Elimina tag';
    del.addEventListener('click', e => {
      e.stopPropagation();
      _saveTags(loadTags().filter(t => t.name !== tagObj.name));
      _editingTags = _editingTags.filter(t => t !== tagObj.name);
      _renderTmTags();
      _renderTagRepo();
    });

    chip.appendChild(label);
    chip.appendChild(del);
    wrap.appendChild(chip);
  });
}

function _addPendingTag() {
  const input = document.getElementById('tmTagInput');
  const val   = input.value.trim().replace(/,/g, '');
  if (!val) return;

  const repo = loadTags();
  if (!repo.find(t => t.name === val)) {
    repo.push({ name: val, color: _newTagColor });
    _saveTags(repo);
  }
  if (!_editingTags.includes(val)) {
    _editingTags.push(val);
    _renderTmTags();
  }
  _renderTagRepo();
  input.value = '';
}

// ── Public: called by FAB ────────────────────────────────
function addKanbanTask() {
  const colId = loadCols()[0]?.id || 'todo';
  const all   = loadKanban();
  all.push({ id: uid(), col: colId, title: '', body: '', tags: [], color: TASK_COLORS[1] });
  _saveKanban(all);
  renderKanban();
}

// ── Subtitle for dashboard tile ──────────────────────────
function _kanbanSubtitle() {
  const tasks = loadKanban();
  if (!tasks.length) return 'Nessun task';
  const cols  = loadCols();
  const parts = cols
    .map(c => ({ label: c.label, n: tasks.filter(t => t.col === c.id).length }))
    .filter(x => x.n > 0)
    .map(x => `${x.n} ${x.label.toLowerCase()}`);
  return parts.join(' · ') || `${tasks.length} task`;
}

// ── Wire modal (once at boot) ────────────────────────────
(function _initTaskModal() {
  const $modal    = document.getElementById('taskModal');
  const $tagInput = document.getElementById('tmTagInput');

  $tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); _addPendingTag(); }
  });

  document.getElementById('tmSave').addEventListener('click', () => {
    _addPendingTag();
    const title = document.getElementById('tmTitle').value.trim();
    const body  = document.getElementById('tmBody').value.trim();
    const all   = loadKanban();
    if (_editingId) {
      const t = all.find(x => x.id === _editingId);
      if (t) Object.assign(t, { title, body, tags: [..._editingTags], color: _editingColor });
    } else {
      all.push({ id: uid(), col: _editingCol, title, body, tags: [..._editingTags], color: _editingColor });
    }
    _saveKanban(all);
    renderKanban();
    _closeModal();
  });

  document.getElementById('tmDelete').addEventListener('click', () => {
    if (!_editingId) return;
    showConfirm({
      title: 'Eliminare task?',
      message: 'Questa azione non può essere annullata.',
      confirmLabel: 'Elimina',
      danger: true,
      onConfirm: () => {
        _saveKanban(loadKanban().filter(t => t.id !== _editingId));
        renderKanban();
        _closeModal();
      },
    });
  });

  document.getElementById('tmCancel').addEventListener('click', _closeModal);
  $modal.addEventListener('pointerdown', e => { if (e.target === $modal) _closeModal(); });
})();
