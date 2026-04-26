'use strict';

const KANBAN_KEY = 'kanban_board';
const KANBAN_COLS = [
  { id: 'todo',  label: 'To Do', color: '#0288D1' },
  { id: 'doing', label: 'Doing', color: '#E65100' },
  { id: 'done',  label: 'Done',  color: '#2E7D32' },
];
const TASK_COLORS = ['#7B1FA2','#0288D1','#E65100','#2E7D32','#C2185B','#F57F17'];

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

// ── Tag colour (stable hash → TASK_COLORS) ───────────────
function _tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TASK_COLORS[h % TASK_COLORS.length];
}

// ── Modal state ──────────────────────────────────────────
let _editingId    = null;
let _editingCol   = 'todo';
let _editingTags  = [];
let _editingColor = TASK_COLORS[1];

// ── Drag state ───────────────────────────────────────────
let _dragId      = null;
let _kanbanWired = false;

// ── Render ───────────────────────────────────────────────
function renderKanban() {
  const tasks = loadKanban();
  KANBAN_COLS.forEach(col => {
    const el = document.getElementById(`kanban-${col.id}`);
    if (!el) return;
    el.innerHTML = '';
    tasks.filter(t => t.col === col.id)
         .forEach(t => el.appendChild(_buildKanbanCard(t)));
  });
  _wireKanbanOnce();
}

function _buildKanbanCard(task) {
  const colIdx = KANBAN_COLS.findIndex(c => c.id === task.col);
  const color  = task.color || TASK_COLORS[1];

  const card = document.createElement('div');
  card.className  = 'kcard';
  card.dataset.id = task.id;
  card.draggable  = true;

  const tagsHtml = (task.tags || [])
    .map(t => `<span class="kcard-tag" style="background:${_tagColor(t)}">${escHtml(t)}</span>`)
    .join('');

  card.innerHTML = `
    <div class="kcard-stripe" style="background:${color}"></div>
    <div class="kcard-content">
      <div class="kcard-title">${escHtml(task.title || 'Senza titolo')}</div>
      ${tagsHtml ? `<div class="kcard-tags">${tagsHtml}</div>` : ''}
      ${task.body ? `<div class="kcard-desc">${escHtml(task.body)}</div>` : ''}
    </div>
    <div class="kcard-actions">
      <button class="kcard-mv" data-dir="-1" ${colIdx === 0 ? 'disabled' : ''} title="Indietro">←</button>
      <button class="kcard-edit" title="Modifica">✎</button>
      <button class="kcard-mv" data-dir="1"  ${colIdx === KANBAN_COLS.length - 1 ? 'disabled' : ''} title="Avanti">→</button>
    </div>
  `;

  card.querySelector('.kcard-edit').addEventListener('click', e => {
    e.stopPropagation();
    _openModal(task.id);
  });

  card.querySelectorAll('.kcard-mv').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const newIdx = colIdx + parseInt(btn.dataset.dir);
      if (newIdx < 0 || newIdx >= KANBAN_COLS.length) return;
      const tasks = loadKanban();
      const t = tasks.find(x => x.id === task.id);
      if (t) { t.col = KANBAN_COLS[newIdx].id; _saveKanban(tasks); renderKanban(); }
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

// ── Wire columns once (static HTML, not recreated on render) ─
function _wireKanbanOnce() {
  if (_kanbanWired) return;
  _kanbanWired = true;

  document.querySelectorAll('.kanban-cards').forEach(zone => {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (!_dragId) return;
      const colId = zone.dataset.col;
      const tasks = loadKanban();
      const t = tasks.find(x => x.id === _dragId);
      if (t && t.col !== colId) { t.col = colId; _saveKanban(tasks); renderKanban(); }
    });
  });

  document.querySelectorAll('.kanban-add-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      _openModal(null, btn.closest('.kanban-col').dataset.col)
    );
  });
}

// ── Modal ────────────────────────────────────────────────
function _openModal(taskId, col) {
  const task = taskId ? loadKanban().find(t => t.id === taskId) : null;
  _editingId    = taskId || null;
  _editingCol   = col || task?.col || 'todo';
  _editingTags  = task ? [...(task.tags || [])] : [];
  _editingColor = task?.color || TASK_COLORS[1];

  document.getElementById('tmTitle').value = task?.title || '';
  document.getElementById('tmBody').value  = task?.body  || '';
  document.getElementById('tmTagInput').value = '';
  document.getElementById('tmDelete').classList.toggle('hidden', !taskId);

  _renderTmTags();
  _renderTmColors();
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

function _addPendingTag() {
  const input = document.getElementById('tmTagInput');
  const val = input.value.trim().replace(/,/g, '');
  if (val && !_editingTags.includes(val)) { _editingTags.push(val); _renderTmTags(); }
  input.value = '';
}

// ── Public: called by FAB ────────────────────────────────
function addKanbanTask() {
  _openModal(null, 'todo');
}

// ── Subtitle for dashboard tile ──────────────────────────
function _kanbanSubtitle() {
  const tasks = loadKanban();
  if (!tasks.length) return 'Nessun task';
  const done  = tasks.filter(t => t.col === 'done').length;
  const doing = tasks.filter(t => t.col === 'doing').length;
  const todo  = tasks.length - done - doing;
  if (done === tasks.length) return 'Tutti completati ✓';
  const parts = [];
  if (todo)  parts.push(`${todo} da fare`);
  if (doing) parts.push(`${doing} in corso`);
  if (done)  parts.push(`${done} completati`);
  return parts.join(' · ');
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
    const tasks = loadKanban();
    if (_editingId) {
      const t = tasks.find(x => x.id === _editingId);
      if (t) Object.assign(t, { title, body, tags: [..._editingTags], color: _editingColor });
    } else {
      tasks.push({ id: uid(), col: _editingCol, title, body, tags: [..._editingTags], color: _editingColor });
    }
    _saveKanban(tasks);
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
