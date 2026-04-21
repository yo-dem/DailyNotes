'use strict';

// ── State ──────────────────────────────────────────────
const ACCENT_COUNT = 6;
const DAYS_IT = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

let currentDate = new Date();
currentDate.setHours(0,0,0,0);

let editingNoteId = null;
let dragSrcIndex = null;

// ── Storage ────────────────────────────────────────────
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function loadTodos(d) {
  try {
    const raw = localStorage.getItem(dateKey(d));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTodos(d, todos) {
  localStorage.setItem(dateKey(d), JSON.stringify(todos));
}

function getTodos() { return loadTodos(currentDate); }
function setTodos(todos) { saveTodos(currentDate, todos); }

// ── Helpers ────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function formatDate(d) {
  return `${DAYS_IT[d.getDay()]} ${d.getDate()} ${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`;
}

function shiftDate(d, delta) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + delta);
  return nd;
}

function previewText(content) {
  if (!content) return '';
  const plain = content.replace(/\s+/g,' ').trim();
  return plain.length > 70 ? plain.slice(0,70) + '…' : plain;
}

// ── DOM refs ───────────────────────────────────────────
const $dateLabel    = document.getElementById('currentDate');
const $waterDay     = document.getElementById('watermarkDay');
const $waterMonth   = document.getElementById('watermarkMonth');
const $list         = document.getElementById('todoList');
const $fab          = document.getElementById('addTodo');
const $dateModal    = document.getElementById('dateModal');
const $datePicker   = document.getElementById('datePicker');
const $dateConfirm  = document.getElementById('dateConfirm');
const $dateCancel   = document.getElementById('dateCancel');
const $noteModal    = document.getElementById('noteModal');
const $noteTitle    = document.getElementById('noteModalTitle');
const $noteContent  = document.getElementById('noteContent');
const $noteSave     = document.getElementById('noteSave');
const $noteCancel   = document.getElementById('noteCancel');

// ── Render ─────────────────────────────────────────────
function render() {
  // Header
  $dateLabel.textContent = formatDate(currentDate);
  $waterDay.textContent  = currentDate.getDate();
  $waterMonth.textContent = MONTHS_IT[currentDate.getMonth()];

  // List
  const todos = getTodos();
  $list.innerHTML = '';

  if (todos.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Nessun appunto. Premi + per aggiungere.';
    $list.appendChild(li);
    return;
  }

  todos.forEach((todo, index) => {
    $list.appendChild(buildCard(todo, index));
  });
}

function buildCard(todo, index) {
  const accentIdx = typeof todo.accent === 'number' ? todo.accent : (index % ACCENT_COUNT);

  const li = document.createElement('li');
  li.className = 'todo-card';
  li.draggable = true;
  li.dataset.id = todo.id;

  li.innerHTML = `
    <div class="card-accent accent-${accentIdx}"></div>
    <div class="card-body">
      <input class="card-title" data-accent="${accentIdx}" type="text"
             value="${escHtml(todo.title)}" placeholder="Titolo..." spellcheck="false" />
      <div class="card-preview">${escHtml(previewText(todo.content))}</div>
    </div>
    <div class="card-right">
      <button class="reminder-btn ${todo.time ? 'has-time' : ''}" title="Imposta reminder">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
        <span class="time-label">${todo.time || '--:--'}</span>
      </button>
      <input type="time" class="time-input" value="${todo.time || ''}" />
      <button class="menu-btn" title="Opzioni">
        <span></span><span></span><span></span>
      </button>
      <div class="card-menu">
        <button class="open-note-btn">Apri nota</button>
        <button class="delete-btn danger">Elimina</button>
      </div>
    </div>`;

  // Title editing
  const titleInput = li.querySelector('.card-title');
  titleInput.addEventListener('change', () => updateField(todo.id, 'title', titleInput.value));
  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); titleInput.blur(); }
  });

  // Preview → open note modal
  li.querySelector('.card-preview').addEventListener('click', () => openNoteModal(todo.id));

  // Reminder
  const reminderBtn = li.querySelector('.reminder-btn');
  const timeInput   = li.querySelector('.time-input');
  reminderBtn.addEventListener('click', e => {
    e.stopPropagation();
    timeInput.showPicker ? timeInput.showPicker() : timeInput.click();
  });
  timeInput.addEventListener('change', () => {
    updateField(todo.id, 'time', timeInput.value);
  });

  // Menu
  const menuBtn  = li.querySelector('.menu-btn');
  const cardMenu = li.querySelector('.card-menu');
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    closeAllMenus();
    cardMenu.classList.toggle('open');
  });

  li.querySelector('.open-note-btn').addEventListener('click', e => {
    e.stopPropagation();
    cardMenu.classList.remove('open');
    openNoteModal(todo.id);
  });

  li.querySelector('.delete-btn').addEventListener('click', e => {
    e.stopPropagation();
    deleteTodo(todo.id);
  });

  // Drag & Drop
  li.addEventListener('dragstart', onDragStart);
  li.addEventListener('dragover',  onDragOver);
  li.addEventListener('drop',      onDrop);
  li.addEventListener('dragend',   onDragEnd);
  li.addEventListener('dragleave', onDragLeave);

  return li;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── CRUD ───────────────────────────────────────────────
function addTodo() {
  const todos = getTodos();
  const accentIdx = todos.length % ACCENT_COUNT;
  const newTodo = {
    id: uid(),
    title: '',
    content: '',
    time: '',
    accent: accentIdx,
    order: 0
  };
  todos.unshift(newTodo);
  setTodos(todos);
  render();

  // Focus title of first card
  const firstTitle = $list.querySelector('.card-title');
  if (firstTitle) { firstTitle.focus(); firstTitle.select(); }
}

function updateField(id, field, value) {
  const todos = getTodos();
  const t = todos.find(x => x.id === id);
  if (!t) return;
  t[field] = value;
  setTodos(todos);
  // Re-render only the preview if content changed
  if (field === 'content' || field === 'time') render();
}

function deleteTodo(id) {
  const todos = getTodos().filter(x => x.id !== id);
  setTodos(todos);
  render();
}

// ── Note Modal ─────────────────────────────────────────
function openNoteModal(id) {
  const todos = getTodos();
  const t = todos.find(x => x.id === id);
  if (!t) return;
  editingNoteId = id;
  $noteTitle.textContent = t.title || '(senza titolo)';
  $noteContent.value = t.content || '';
  $noteModal.classList.remove('hidden');
  setTimeout(() => $noteContent.focus(), 60);
}

function closeNoteModal() {
  $noteModal.classList.add('hidden');
  editingNoteId = null;
}

$noteSave.addEventListener('click', () => {
  if (!editingNoteId) return;
  updateField(editingNoteId, 'content', $noteContent.value);
  closeNoteModal();
});

$noteCancel.addEventListener('click', closeNoteModal);

$noteModal.addEventListener('click', e => {
  if (e.target === $noteModal) closeNoteModal();
});

// ── Date Modal ─────────────────────────────────────────
function openDateModal() {
  $datePicker.value = dateKey(currentDate);
  $dateModal.classList.remove('hidden');
  setTimeout(() => $datePicker.focus(), 60);
}

function closeDateModal() {
  $dateModal.classList.add('hidden');
}

$dateConfirm.addEventListener('click', () => {
  if ($datePicker.value) {
    const [y,m,d] = $datePicker.value.split('-').map(Number);
    currentDate = new Date(y, m-1, d);
  }
  closeDateModal();
  render();
});

$dateCancel.addEventListener('click', closeDateModal);

$dateModal.addEventListener('click', e => {
  if (e.target === $dateModal) closeDateModal();
});

// ── Navigation ─────────────────────────────────────────
document.getElementById('prevDay').addEventListener('click', () => {
  currentDate = shiftDate(currentDate, -1);
  render();
});

document.getElementById('nextDay').addEventListener('click', () => {
  currentDate = shiftDate(currentDate, +1);
  render();
});

$dateLabel.addEventListener('click', openDateModal);
$fab.addEventListener('click', addTodo);

// Close menus on outside click
document.addEventListener('click', closeAllMenus);

function closeAllMenus() {
  document.querySelectorAll('.card-menu.open').forEach(m => m.classList.remove('open'));
}

// ── Drag & Drop ────────────────────────────────────────
function cardIndexOf(li) {
  return [...$list.querySelectorAll('.todo-card')].indexOf(li);
}

function onDragStart(e) {
  dragSrcIndex = cardIndexOf(this);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIndex);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.todo-card').forEach(c => c.classList.remove('drag-over'));
  this.classList.add('drag-over');
  return false;
}

function onDragLeave() {
  this.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const destIndex = cardIndexOf(this);
  if (dragSrcIndex === null || dragSrcIndex === destIndex) return;

  const todos = getTodos();
  const [moved] = todos.splice(dragSrcIndex, 1);
  todos.splice(destIndex, 0, moved);
  setTodos(todos);
  render();
}

function onDragEnd() {
  document.querySelectorAll('.todo-card').forEach(c => {
    c.classList.remove('dragging','drag-over');
  });
  dragSrcIndex = null;
}

// ── Keyboard shortcuts ─────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeNoteModal();
    closeDateModal();
    closeAllMenus();
  }
  if ((e.key === 'ArrowLeft') && !isInputFocused()) {
    currentDate = shiftDate(currentDate, -1);
    render();
  }
  if ((e.key === 'ArrowRight') && !isInputFocused()) {
    currentDate = shiftDate(currentDate, +1);
    render();
  }
});

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

// ── Boot ───────────────────────────────────────────────
render();
