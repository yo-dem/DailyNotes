'use strict';

const KANBAN_KEY           = 'kanban_board';
const KANBAN_COLS_KEY      = 'kanban_cols';
const KANBAN_TAGS_KEY      = 'kanban_tags';
const KANBAN_ASSIGNEES_KEY = 'kanban_assignees';
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
function _saveKanban(tasks) { localStorage.setItem(KANBAN_KEY, JSON.stringify(tasks)); }

function loadCols() {
  try {
    const raw = localStorage.getItem(KANBAN_COLS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return _DEFAULT_COLS.map(c => ({ ...c }));
}
function _saveCols(cols) { localStorage.setItem(KANBAN_COLS_KEY, JSON.stringify(cols)); }

function loadTags() {
  try {
    const raw = localStorage.getItem(KANBAN_TAGS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function _saveTags(tags) { localStorage.setItem(KANBAN_TAGS_KEY, JSON.stringify(tags)); }

function loadAssignees() {
  try {
    const raw = localStorage.getItem(KANBAN_ASSIGNEES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map(a => typeof a === 'string' ? { name: a, color: TASK_COLORS[3] } : a);
  } catch { return []; }
}
function _saveAssignees(items) { localStorage.setItem(KANBAN_ASSIGNEES_KEY, JSON.stringify(items)); }

// ── Tag colour ───────────────────────────────────────────
function _tagColor(tagName) {
  const found = loadTags().find(t => t.name === tagName);
  if (found) return found.color;
  let h = 0;
  for (let i = 0; i < tagName.length; i++) h = (h * 31 + tagName.charCodeAt(i)) >>> 0;
  return TASK_COLORS[h % TASK_COLORS.length];
}

// ── Modal state ──────────────────────────────────────────
let _editingId        = null;
let _editingCol       = 'todo';
let _editingTags      = [];
let _editingColor     = TASK_COLORS[1];
let _editingChecklist  = [];
let _editingAssignees  = [];

// ── Drag state ───────────────────────────────────────────
let _cardDrag = null;
let _colDrag  = null;
let _dblTap   = { cardId: null, time: 0 };

function _addTaskToCol(colId) {
  const all = loadKanban();
  all.push({ id: uid(), col: colId, title: _nextTaskTitle(), body: '', tags: [], color: TASK_COLORS[1] });
  _saveKanban(all);
  renderKanban();
}

// ── Render ───────────────────────────────────────────────
function renderKanban() {
  const $board = document.getElementById('kanbanBoard');
  if (!$board) return;

  const cols  = loadCols();
  const tasks = loadKanban();
  $board.innerHTML = '';

  cols.forEach(col => {
    const colEl = document.createElement('div');
    colEl.className   = 'kanban-col';
    colEl.dataset.col = col.id;

    const header = document.createElement('div');
    header.className = 'kanban-col-header';
    header.innerHTML = `
      <span class="kanban-col-grip" title="Trascina sezione">⠿</span>
      <span class="kanban-col-dot" style="background:${col.color}" title="Cambia colore"></span>
      <span class="kanban-col-title" contenteditable="true" spellcheck="false">${escHtml(col.label)}</span>
      <button class="kanban-del-btn" title="Elimina sezione">×</button>
    `;
    colEl.appendChild(header);

    const cardsEl = document.createElement('div');
    cardsEl.className   = 'kanban-cards';
    cardsEl.dataset.col = col.id;
    colEl.appendChild(cardsEl);

    const footer = document.createElement('div');
    footer.className = 'kanban-col-footer';
    footer.innerHTML = `<button class="kanban-add-btn" title="Aggiungi task">+ Aggiungi task</button>`;
    colEl.appendChild(footer);

    tasks.filter(t => t.col === col.id)
         .forEach(t => cardsEl.appendChild(_buildKanbanCard(t)));

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

    // Dot → colour picker
    header.querySelector('.kanban-col-dot').addEventListener('click', e => {
      e.stopPropagation();
      _openColColorPicker(e.currentTarget, col.id);
    });

    // Add-task button
    footer.querySelector('.kanban-add-btn').addEventListener('click', () => {
      _addTaskToCol(col.id);
    });

    // Double-click on column body adds a task
    cardsEl.addEventListener('dblclick', e => {
      if (e.target.closest('.kcard')) return;
      _addTaskToCol(col.id);
    });

    // Touch double-tap on column body
    let _colTapTimer = null;
    let _colTapCount = 0;
    cardsEl.addEventListener('touchend', e => {
      if (e.target.closest('.kcard')) return;
      _colTapCount++;
      if (_colTapCount === 1) {
        _colTapTimer = setTimeout(() => { _colTapCount = 0; }, 350);
      } else {
        clearTimeout(_colTapTimer);
        _colTapCount = 0;
        _addTaskToCol(col.id);
      }
    }, { passive: true });

    // Delete column
    header.querySelector('.kanban-del-btn').addEventListener('click', () => {
      const cardCount = loadKanban().filter(t => t.col === col.id).length;
      const msg = cardCount
        ? `La sezione "${col.label}" e ${cardCount === 1 ? 'il task al suo interno' : `i ${cardCount} task al suo interno`} verranno eliminati definitivamente.`
        : `La sezione "${col.label}" verrà eliminata definitivamente.`;
      showConfirm({
        title: 'Eliminare sezione?', message: msg, confirmLabel: 'Elimina', danger: true,
        onConfirm: () => {
          _saveCols(loadCols().filter(c => c.id !== col.id));
          _saveKanban(loadKanban().filter(t => t.col !== col.id));
          renderKanban();
        },
      });
    });

    // Column drag handle
    header.querySelector('.kanban-col-grip').addEventListener('pointerdown', _onColPointerDown);

    $board.appendChild(colEl);
  });
}

// ── Card builder ─────────────────────────────────────────
function _buildKanbanCard(task) {
  const color = task.color || TASK_COLORS[1];

  const card = document.createElement('div');
  card.className  = 'kcard';
  card.dataset.id = task.id;

  const tagsHtml = (task.tags || [])
    .map(t => `<span class="kcard-tag" style="background:${_tagColor(t)}">${escHtml(t)}</span>`)
    .join('');

  const assignees = task.assignees || [];
  const asgnRepo  = loadAssignees();
  const footerHtml = `
    <div class="kcard-footer">
      <svg class="kcard-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      ${assignees.length
        ? assignees.map(n => {
            const c = asgnRepo.find(a => a.name === n)?.color || TASK_COLORS[3];
            return `<span class="kcard-assignee-badge" style="background:${c}">${escHtml(n)}</span>`;
          }).join('')
        : `<span class="kcard-footer-names">Tutti</span>`}
    </div>`;

  const cl = task.checklist || [];
  const clDone = cl.filter(i => i.done).length;
  const clHtml = cl.length ? `
    <div class="kcard-checklist">
      <div class="kcard-cl-bar"><div class="kcard-cl-fill" style="width:${Math.round(clDone / cl.length * 100)}%"></div></div>
      ${cl.map(item => `
        <div class="kcard-cl-row${item.done ? ' done' : ''}" data-item-id="${item.id}">
          <span class="kcard-cl-box"></span>
          <span class="kcard-cl-text">${escHtml(item.text)}</span>
        </div>`).join('')}
    </div>` : '';

  card.innerHTML = `
    <button class="kcard-del" title="Elimina">×</button>
    <div class="kcard-stripe" style="background:${color}"></div>
    <div class="kcard-content">
      <div class="kcard-title">${escHtml(task.title || 'Senza titolo')}</div>
      ${tagsHtml ? `<div class="kcard-tags">${tagsHtml}</div>` : ''}
      ${task.body ? `<div class="kcard-desc">${escHtml(task.body)}</div>` : ''}
    </div>
    ${clHtml}
    ${footerHtml}
  `;

  card.querySelector('.kcard-del').addEventListener('click', e => {
    e.stopPropagation();
    showConfirm({
      title: 'Eliminare task?',
      message: `"${escHtml(task.title || 'Senza titolo')}" verrà rimosso definitivamente.`,
      confirmLabel: 'Elimina', danger: true,
      onConfirm: () => { _saveKanban(loadKanban().filter(t => t.id !== task.id)); renderKanban(); },
    });
  });

  // Unified pointer drag: whole card surface
  card.addEventListener('pointerdown', _onCardPointerDown);

  return card;
}

// ── Card drag – unified within-col & cross-col ───────────
function _onCardPointerDown(e) {
  if (e.button !== 0) return;
  if (_cardDrag || _colDrag) return;
  if (e.target.closest('.kcard-del')) return;
  e.preventDefault();

  const card   = e.currentTarget;
  const $board = document.getElementById('kanbanBoard');

  // Snapshot all columns and their cards
  const colData = [...$board.querySelectorAll('.kanban-col')].map(colEl => {
    const cardsEl = colEl.querySelector('.kanban-cards');
    const cardEls = [...cardsEl.querySelectorAll('.kcard')];
    cardEls.forEach(c => { c.style.transition = 'none'; c.style.transform = ''; });
    const colRect   = colEl.getBoundingClientRect();
    const slotRects = cardEls.map(c => {
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    return { colId: colEl.dataset.col, colEl, cardsEl, cardEls, colRect, slotRects };
  });

  const srcColId   = card.closest('.kanban-col').dataset.col;
  const srcColData = colData.find(cd => cd.colId === srcColId);
  const srcIdx     = srcColData.cardEls.indexOf(card);
  const sr         = srcColData.slotRects[srcIdx];

  const clone = card.cloneNode(true);
  Object.assign(clone.style, {
    position: 'fixed', left: `${sr.left}px`, top: `${sr.top}px`,
    width: `${sr.width}px`, height: `${sr.height}px`,
    margin: '0', zIndex: '2000', pointerEvents: 'none',
    transform: 'scale(1.03)', boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
  });
  document.body.appendChild(clone);
  card.classList.add('kcard--ghost');

  _cardDrag = {
    card, clone, colData, srcColData, srcColId, srcIdx,
    targetColId: srcColId, nearestIdx: srcIdx, currentOrder: null,
    ox: e.clientX - sr.left, oy: e.clientY - sr.top, moved: false,
  };

  document.addEventListener('pointermove',   _onCardPointerMove);
  document.addEventListener('pointerup',     _onCardPointerUp);
  document.addEventListener('pointercancel', _onCardPointerUp);
}

function _onCardPointerMove(e) {
  if (!_cardDrag) return;
  const { clone, colData, srcColData, srcColId, srcIdx, ox, oy, card } = _cardDrag;
  const sr = srcColData.slotRects[srcIdx];

  const x = e.clientX - ox;
  const y = e.clientY - oy;

  if (!_cardDrag.moved) {
    if (Math.hypot(e.clientX - (sr.left + ox), e.clientY - (sr.top + oy)) < 8) return;
    _cardDrag.moved = true;
  }

  clone.style.left = `${x}px`;
  clone.style.top  = `${y}px`;

  const cx = x + sr.width  / 2;
  const cy = y + sr.height / 2;

  // Which column is the clone over?
  let targetCD = colData.find(cd => cx >= cd.colRect.left && cx <= cd.colRect.right);
  if (!targetCD) return;

  const targetColId    = targetCD.colId;
  const prevTargetColId = _cardDrag.targetColId;

  // Nearest insertion index in target column
  let nearestIdx = targetCD.cardEls.length;
  let minDist    = Infinity;
  targetCD.slotRects.forEach((r, i) => {
    // Skip the ghost card's own slot when same column
    if (targetColId === srcColId && i === srcIdx) return;
    const d = Math.abs(cy - (r.top + r.height / 2));
    if (d < minDist) { minDist = d; nearestIdx = i; }
  });

  if (targetColId === _cardDrag.targetColId && nearestIdx === _cardDrag.nearestIdx) return;

  // Restore previous target column's cards when switching columns
  if (prevTargetColId !== targetColId) {
    const prevCD = colData.find(cd => cd.colId === prevTargetColId);
    if (prevCD) {
      prevCD.cardEls.forEach(c => {
        if (c !== card) { c.style.transition = 'transform 0.18s ease'; c.style.transform = ''; }
      });
    }
  }

  _cardDrag.targetColId = targetColId;
  _cardDrag.nearestIdx  = nearestIdx;

  if (targetColId === srcColId) {
    // Within-column: reorder preview
    const origIds  = srcColData.cardEls.map(c => c.dataset.id);
    const newOrder = [...origIds];
    const [moved]  = newOrder.splice(srcIdx, 1);
    newOrder.splice(nearestIdx, 0, moved);
    _cardDrag.currentOrder = newOrder;

    srcColData.cardEls.forEach((c, domIdx) => {
      if (c === card) return;
      const tIdx = newOrder.indexOf(c.dataset.id);
      if (tIdx === -1) return;
      const tr = srcColData.slotRects[tIdx];
      const cr = srcColData.slotRects[domIdx];
      c.style.transition = 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)';
      c.style.transform  = `translateY(${tr.top - cr.top}px)`;
    });
  } else {
    // Cross-column: restore source, open gap in target
    srcColData.cardEls.forEach(c => {
      if (c !== card) { c.style.transition = 'transform 0.18s ease'; c.style.transform = ''; }
    });
    const shiftAmount = sr.height + 8;
    targetCD.cardEls.forEach((c, i) => {
      c.style.transition = 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)';
      c.style.transform  = i >= nearestIdx ? `translateY(${shiftAmount}px)` : '';
    });
    _cardDrag.currentOrder = null;
  }
}

function _onCardPointerUp() {
  if (!_cardDrag) return;
  const { card, clone, colData, srcColData, srcColId, srcIdx, targetColId, nearestIdx, moved, currentOrder } = _cardDrag;

  document.removeEventListener('pointermove',   _onCardPointerMove);
  document.removeEventListener('pointerup',     _onCardPointerUp);
  document.removeEventListener('pointercancel', _onCardPointerUp);
  _cardDrag = null;

  if (!moved) {
    clone.remove();
    card.classList.remove('kcard--ghost');
    // Double-tap → edit
    const now = Date.now();
    if (_dblTap.cardId === card.dataset.id && now - _dblTap.time < 350) {
      _dblTap = { cardId: null, time: 0 };
      _openModal(card.dataset.id);
    } else {
      _dblTap = { cardId: card.dataset.id, time: now };
    }
    return;
  }

  // Animate clone to its final slot
  const targetCD    = colData.find(cd => cd.colId === targetColId);
  const sr          = srcColData.slotRects[srcIdx];
  let   fr          = null;

  if (targetColId === srcColId && currentOrder) {
    const finalIdx = currentOrder.indexOf(card.dataset.id);
    fr = srcColData.slotRects[finalIdx] ?? sr;
  } else if (targetCD) {
    if (nearestIdx < targetCD.cardEls.length) {
      fr = targetCD.slotRects[nearestIdx];
    } else if (targetCD.slotRects.length > 0) {
      const lr = targetCD.slotRects[targetCD.slotRects.length - 1];
      fr = { left: lr.left, top: lr.top + lr.height + 8, width: lr.width, height: lr.height };
    } else {
      const cr = targetCD.cardsEl.getBoundingClientRect();
      fr = { left: cr.left + 10, top: cr.top + 10, width: sr.width, height: sr.height };
    }
  }

  if (fr) {
    clone.style.transition = 'left 0.2s ease, top 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease';
    clone.style.left       = `${fr.left}px`;
    clone.style.top        = `${fr.top}px`;
    clone.style.transform  = 'scale(1)';
    clone.style.boxShadow  = '0 2px 8px rgba(0,0,0,0.14)';
  }

  const all    = loadKanban();
  const taskId = card.dataset.id;

  if (targetColId === srcColId && currentOrder) {
    // Within-column reorder
    const colTasks   = currentOrder.map(id => all.find(t => t.id === id)).filter(Boolean);
    const otherTasks = all.filter(t => t.col !== srcColId);
    setTimeout(() => { clone.remove(); _saveKanban([...otherTasks, ...colTasks]); renderKanban(); }, 200);
  } else {
    // Cross-column move
    const task = all.find(t => t.id === taskId);
    if (!task) { setTimeout(() => { clone.remove(); renderKanban(); }, 200); return; }
    task.col = targetColId;
    const targetColTasks = all.filter(t => t.col === targetColId && t.id !== taskId);
    targetColTasks.splice(Math.min(nearestIdx, targetColTasks.length), 0, task);
    const otherTasks = all.filter(t => t.col !== targetColId);
    setTimeout(() => { clone.remove(); _saveKanban([...otherTasks, ...targetColTasks]); renderKanban(); }, 200);
  }
}

// ── Column colour picker ─────────────────────────────────
const COL_COLORS = [
  '#0288D1','#2E7D32','#E65100','#7B1FA2',
  '#C2185B','#F57F17','#00838F','#4527A0',
  '#558B2F','#6D4C41','#37474F','#D32F2F',
];

function _openColColorPicker(dotEl, colId) {
  document.querySelector('.col-color-pop')?.remove();
  const pop = document.createElement('div');
  pop.className = 'col-color-pop';

  COL_COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'col-color-swatch';
    btn.style.background = c;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const cols = loadCols();
      const col  = cols.find(x => x.id === colId);
      if (col) { col.color = c; _saveCols(cols); }
      pop.remove();
      renderKanban();
    });
    pop.appendChild(btn);
  });

  const r = dotEl.getBoundingClientRect();
  pop.style.top  = `${r.bottom + 6}px`;
  pop.style.left = `${r.left}px`;
  document.body.appendChild(pop);

  const close = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('pointerdown', close); } };
  setTimeout(() => document.addEventListener('pointerdown', close), 0);
}

// ── Column drag (pointer-based) ──────────────────────────
function _onColPointerDown(e) {
  if (e.button !== 0) return;
  if (_colDrag || _cardDrag) return;
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
    position: 'fixed', left: `${sr.left}px`, top: `${sr.top}px`,
    width: `${sr.width}px`, height: `${sr.height}px`,
    margin: '0', zIndex: '2000', pointerEvents: 'none',
    transform: 'scale(1.02)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
    opacity: '0.96', borderRadius: '20px',
  });
  document.body.appendChild(clone);
  col.classList.add('kanban-col--ghost');

  _colDrag = {
    col, clone, srcIdx, slotRects,
    nearestIdx: srcIdx, currentOrder: loadCols().map(c => c.id),
    ox: e.clientX - sr.left, oy: e.clientY - sr.top, moved: false,
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
    if (Math.hypot(e.clientX - (slotRects[srcIdx].left + ox), e.clientY - (slotRects[srcIdx].top + oy)) < 8) return;
    _colDrag.moved = true;
  }

  clone.style.left = `${x}px`;
  clone.style.top  = `${y}px`;

  const cx = x + slotRects[srcIdx].width / 2;
  let nearestIdx = srcIdx, minDist = Infinity;
  slotRects.forEach((r, i) => {
    const d = Math.abs(cx - (r.left + r.width / 2));
    if (d < minDist) { minDist = d; nearestIdx = i; }
  });

  if (nearestIdx === _colDrag.nearestIdx) return;
  _colDrag.nearestIdx = nearestIdx;

  const ids = loadCols().map(c => c.id);
  const newOrder = [...ids];
  const [moved] = newOrder.splice(srcIdx, 1);
  newOrder.splice(nearestIdx, 0, moved);
  _colDrag.currentOrder = newOrder;

  const $board = document.getElementById('kanbanBoard');
  [...$board.querySelectorAll('.kanban-col')].forEach((c, domIdx) => {
    if (c === col) return;
    const tIdx = newOrder.indexOf(c.dataset.col);
    const tr   = slotRects[tIdx];
    const cr   = slotRects[domIdx];
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

  const finalIdx = currentOrder.indexOf(col.dataset.col);
  const fr       = slotRects[finalIdx];
  clone.style.transition = 'left 0.22s ease, top 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease';
  clone.style.left       = `${fr.left}px`;
  clone.style.top        = `${fr.top}px`;
  clone.style.transform  = 'scale(1)';
  clone.style.boxShadow  = '0 4px 20px rgba(0,0,0,0.18)';

  const savedCols = loadCols();
  _saveCols(currentOrder.map(id => savedCols.find(c => c.id === id)).filter(Boolean));
  setTimeout(() => { try { clone.remove(); } catch {} renderKanban(); }, 220);
}

// ── Add new column (FAB in task view) ────────────────────
function addKanbanColumn() {
  const cols   = loadCols();
  const colors = ['#0288D1','#E65100','#2E7D32','#7B1FA2','#C2185B','#F57F17'];
  cols.push({ id: uid(), label: 'Nuova sezione', color: colors[cols.length % colors.length] });
  _saveCols(cols);
  renderKanban();

  const last = document.getElementById('kanbanBoard')?.lastElementChild;
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

// ── Auto-title for new tasks ─────────────────────────────
function _nextTaskTitle() {
  const titles = new Set(loadKanban().map(t => t.title));
  let n = 1;
  while (titles.has(`Titolo ${n}`)) n++;
  return `Titolo ${n}`;
}

// ── Mini colour picker ───────────────────────────────────
function _openMiniColorPicker(anchorEl, currentColor, onPick) {
  document.querySelector('.mini-color-pop')?.remove();
  const pop = document.createElement('div');
  pop.className = 'mini-color-pop';
  TASK_COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mini-color-swatch' + (c === currentColor ? ' sel' : '');
    btn.style.background = c;
    btn.addEventListener('click', e => { e.stopPropagation(); onPick(c); pop.remove(); });
    pop.appendChild(btn);
  });
  const r = anchorEl.getBoundingClientRect();
  pop.style.top  = `${r.bottom + 4}px`;
  pop.style.left = `${r.left}px`;
  document.body.appendChild(pop);
  const close = ev => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('pointerdown', close); } };
  setTimeout(() => document.addEventListener('pointerdown', close), 0);
}

// ── Modal ────────────────────────────────────────────────
function _openModal(taskId, col) {
  const task    = taskId ? loadKanban().find(t => t.id === taskId) : null;
  _editingId    = taskId || null;
  _editingCol   = col || task?.col || loadCols()[0]?.id || 'todo';
  _editingTags  = task ? [...(task.tags || [])] : [];
  _editingColor = task?.color || TASK_COLORS[1];

  document.getElementById('tmTitle').value    = task?.title || '';
  document.getElementById('tmBody').value     = task?.body  || '';
  document.getElementById('tmTagInput').value = '';
  document.getElementById('tmClone').classList.toggle('hidden', !taskId);

  _editingChecklist  = task ? (task.checklist || []).map(i => ({ ...i })) : [];
  _editingAssignees  = task ? [...(task.assignees || [])] : [];

  _renderTmTags();
  _renderTmColors();
  _renderTagRepo();
  _renderTmChecklist();
  _renderTmAssignees();
  _renderAssigneeRepo();
  document.getElementById('taskModal').classList.remove('hidden');
  document.getElementById('tmTitle').focus();
}

function _closeModal() {
  const $modal = document.getElementById('taskModal');
  if ($modal.classList.contains('hidden')) return;
  _addPendingTag();
  _addPendingAssignee();
  const title = document.getElementById('tmTitle').value.trim();
  const body  = document.getElementById('tmBody').value.trim();
  const all   = loadKanban();
  if (_editingId) {
    const t = all.find(x => x.id === _editingId);
    if (t) Object.assign(t, { title, body, tags: [..._editingTags], color: _editingColor, checklist: _editingChecklist.map(i => ({ ...i })), assignees: [..._editingAssignees] });
    _saveKanban(all);
    renderKanban();
  }
  $modal.classList.add('hidden');
}

function _renderTmTags() {
  const list = document.getElementById('tmTagList');
  list.innerHTML = '';
  _editingTags.forEach((tag, i) => {
    const chip = document.createElement('span');
    chip.className = 'tm-chip';
    chip.style.background = _tagColor(tag);
    chip.innerHTML = `${escHtml(tag)}<button class="tm-chip-del" type="button">×</button>`;
    chip.addEventListener('click', e => {
      if (e.target.closest('.tm-chip-del')) return;
      _openMiniColorPicker(chip, _tagColor(tag), newColor => {
        const repo = loadTags();
        const found = repo.find(t => t.name === tag);
        if (found) found.color = newColor;
        else repo.push({ name: tag, color: newColor });
        _saveTags(repo);
        _renderTmTags();
        _renderTagRepo();
      });
    });
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
    btn.type = 'button';
    btn.className = 'tm-color-dot' + (c === _editingColor ? ' tm-color-dot--sel' : '');
    btn.style.background = c;
    btn.addEventListener('click', () => { _editingColor = c; _renderTmColors(); });
    wrap.appendChild(btn);
  });
}


function _renderTagRepo() {
  const wrap = document.getElementById('tmTagRepo');
  if (!wrap) return;
  wrap.innerHTML = '';
  loadTags().filter(t => !_editingTags.includes(t.name)).forEach(tagObj => {
    const chip = document.createElement('span');
    chip.className = 'tm-repo-chip';
    chip.style.setProperty('--chip-color', tagObj.color);

    const label = document.createElement('span');
    label.className   = 'tm-repo-chip-label';
    label.textContent = tagObj.name;
    label.addEventListener('click', () => {
      _editingTags.push(tagObj.name);
      _renderTmTags();
      _renderTagRepo();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className   = 'tm-repo-chip-del';
    del.textContent = '×';
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

function _renderTmChecklist() {
  const list = document.getElementById('tmChecklistItems');
  if (!list) return;
  list.innerHTML = '';
  _editingChecklist.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'tm-cl-row' + (item.done ? ' done' : '');
    const chk = document.createElement('button');
    chk.type = 'button';
    chk.className = 'tm-cl-check';
    const txt = document.createElement('input');
    txt.type      = 'text';
    txt.className = 'tm-cl-text';
    txt.value     = item.text;
    txt.autocomplete = 'off';
    txt.spellcheck   = false;
    txt.addEventListener('input', () => { item.text = txt.value; });
    txt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); txt.blur(); } });
    const del = document.createElement('button');
    del.type = 'button';
    del.className   = 'tm-cl-del';
    del.textContent = '×';
    chk.addEventListener('click', () => { item.done = !item.done; _renderTmChecklist(); });
    del.addEventListener('click', () => { _editingChecklist.splice(i, 1); _renderTmChecklist(); });
    row.appendChild(chk);
    row.appendChild(txt);
    row.appendChild(del);
    list.appendChild(row);
  });
}

function _addChecklistItem() {
  const input = document.getElementById('tmCheckInput');
  const val   = input.value.trim();
  if (!val) return;
  _editingChecklist.push({ id: uid(), text: val, done: false });
  _renderTmChecklist();
  input.value = '';
  input.focus();
}

function _renderTmAssignees() {
  const list = document.getElementById('tmAssigneeList');
  if (!list) return;
  list.innerHTML = '';
  const repo = loadAssignees();
  _editingAssignees.forEach((name, i) => {
    const asgn  = repo.find(a => a.name === name);
    const color = asgn?.color || TASK_COLORS[3];
    const chip = document.createElement('span');
    chip.className        = 'tm-assignee-chip';
    chip.style.background = color;
    chip.innerHTML = `${escHtml(name)}<button class="tm-assignee-chip-del" type="button">×</button>`;
    chip.addEventListener('click', e => {
      if (e.target.closest('.tm-assignee-chip-del')) return;
      _openMiniColorPicker(chip, color, newColor => {
        const r = loadAssignees();
        const found = r.find(a => a.name === name);
        if (found) { found.color = newColor; _saveAssignees(r); }
        _renderTmAssignees();
        _renderAssigneeRepo();
      });
    });
    chip.querySelector('.tm-assignee-chip-del').addEventListener('pointerdown', e => {
      e.preventDefault();
      _editingAssignees.splice(i, 1);
      _renderTmAssignees();
      _renderAssigneeRepo();
    });
    list.appendChild(chip);
  });
}

function _renderAssigneeRepo() {
  const wrap = document.getElementById('tmAssigneeRepo');
  if (!wrap) return;
  wrap.innerHTML = '';
  loadAssignees().filter(a => !_editingAssignees.includes(a.name)).forEach(asgn => {
    const chip = document.createElement('span');
    chip.className = 'tm-asgn-repo-chip';
    chip.style.borderColor = asgn.color;
    chip.style.color       = asgn.color;

    const swatch = document.createElement('span');
    swatch.className        = 'tm-asgn-repo-swatch';
    swatch.style.background = asgn.color;
    swatch.addEventListener('click', e => {
      e.stopPropagation();
      _openMiniColorPicker(swatch, asgn.color, newColor => {
        const r = loadAssignees();
        const found = r.find(a => a.name === asgn.name);
        if (found) { found.color = newColor; _saveAssignees(r); }
        _renderAssigneeRepo();
        _renderTmAssignees();
      });
    });

    const label = document.createElement('span');
    label.className   = 'tm-asgn-repo-label';
    label.textContent = asgn.name;
    label.addEventListener('click', () => {
      _editingAssignees.push(asgn.name);
      _renderTmAssignees();
      _renderAssigneeRepo();
    });

    const del = document.createElement('button');
    del.type        = 'button';
    del.className   = 'tm-asgn-repo-del';
    del.textContent = '×';
    del.addEventListener('click', e => {
      e.stopPropagation();
      _saveAssignees(loadAssignees().filter(a => a.name !== asgn.name));
      _editingAssignees = _editingAssignees.filter(n => n !== asgn.name);
      _renderTmAssignees();
      _renderAssigneeRepo();
    });

    chip.appendChild(swatch);
    chip.appendChild(label);
    chip.appendChild(del);
    wrap.appendChild(chip);
  });
}

function _addPendingAssignee() {
  const input = document.getElementById('tmAssigneeInput');
  const val   = input.value.trim();
  if (!val) return;
  const repo = loadAssignees();
  if (!repo.find(a => a.name === val)) { repo.push({ name: val, color: TASK_COLORS[3] }); _saveAssignees(repo); }
  if (!_editingAssignees.includes(val)) { _editingAssignees.push(val); _renderTmAssignees(); }
  _renderAssigneeRepo();
  input.value = '';
  input.focus();
}

function _addPendingTag() {
  const input = document.getElementById('tmTagInput');
  const val   = input.value.trim().replace(/,/g, '');
  if (!val) return;
  const repo = loadTags();
  if (!repo.find(t => t.name === val)) { repo.push({ name: val, color: TASK_COLORS[0] }); _saveTags(repo); }
  if (!_editingTags.includes(val)) { _editingTags.push(val); _renderTmTags(); }
  _renderTagRepo();
  input.value = '';
}

// ── Public: called by FAB ────────────────────────────────
function addKanbanTask() {
  const colId = loadCols()[0]?.id || 'todo';
  const all   = loadKanban();
  all.push({ id: uid(), col: colId, title: _nextTaskTitle(), body: '', tags: [], color: TASK_COLORS[1] });
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

  document.getElementById('tmCheckInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _addChecklistItem(); }
  });
  document.getElementById('tmCheckAddBtn').addEventListener('click', () => _addChecklistItem());

  document.getElementById('tmAssigneeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _addPendingAssignee(); }
  });

  document.getElementById('tmClone').addEventListener('click', () => {
    if (!_editingId) return;
    _addPendingTag();
    _addPendingAssignee();
    const title  = document.getElementById('tmTitle').value.trim();
    const body   = document.getElementById('tmBody').value.trim();
    const all    = loadKanban();
    const src    = all.find(t => t.id === _editingId);
    if (src) Object.assign(src, { title, body, tags: [..._editingTags], color: _editingColor, checklist: _editingChecklist.map(i => ({ ...i })), assignees: [..._editingAssignees] });
    const clone  = {
      id:         uid(),
      col:        src?.col || _editingCol,
      title:      `Copia di ${title}`,
      body:       body,
      tags:       [..._editingTags],
      color:      _editingColor,
      checklist:  _editingChecklist.map(i => ({ ...i, id: uid() })),
      assignees:  [..._editingAssignees],
    };
    all.push(clone);
    _saveKanban(all);
    $modal.classList.add('hidden');
    renderKanban();
  });

  $modal.addEventListener('pointerdown', e => { if (e.target === $modal) _closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _closeModal(); });
})();
