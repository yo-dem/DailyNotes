'use strict';

let dragSrcIndex = null;

// ── Rendering ──────────────────────────────────────────

function renderTodos() {
  const $list = document.getElementById('todoList');
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
    $list.appendChild(_buildCard(todo, index));
  });
}

function _buildCard(todo, index) {
  const accentIdx = typeof todo.accent === 'number' ? todo.accent : (index % ACCENT_COUNT);

  const li = document.createElement('li');
  li.className = `todo-card${todo.done ? ' done' : ''}`;
  li.style.setProperty('--card-bg', PASTEL_BG[accentIdx]);
  li.draggable = false;
  li.dataset.id = todo.id;

  li.innerHTML = `
    <div class="card-accent accent-${accentIdx}"></div>
    <div class="card-drag-handle" title="Trascina per riordinare">
      <span></span><span></span><span></span><span></span>
    </div>
    <div class="card-body">
      <div class="card-row">
        <button class="card-check${todo.done ? ' checked' : ''}" title="${todo.done ? 'Segna come da fare' : 'Segna come fatto'}">${todo.done ? SVG.checkFull : SVG.checkEmpty}</button>
        <div class="card-title-wrap" data-value="Titolo...">
          <input class="card-title" data-accent="${accentIdx}" type="text"
                 value="${escHtml(todo.title)}" placeholder="Titolo..." spellcheck="false" />
        </div>
      </div>
      <div class="card-preview">${escHtml(previewText(todo.content))}</div>
    </div>
    <div class="card-right">
      <button class="reminder-btn ${todo.time ? 'has-time' : ''}" title="Imposta orario">
        ${SVG.clock}
        <span class="time-label">${todo.time || '--:--'}</span>
      </button>
      <button class="menu-btn" title="Opzioni">
        <span></span><span></span><span></span>
      </button>
      <div class="card-vsep"></div>
      <button class="card-delete-btn" title="Elimina">${SVG.cross}</button>
    </div>`;

  _bindCardEvents(li, todo);
  return li;
}

function _bindCardEvents(li, todo) {
  const titleInput  = li.querySelector('.card-title');
  const checkBtn    = li.querySelector('.card-check');
  const dragHandle  = li.querySelector('.card-drag-handle');
  const preview     = li.querySelector('.card-preview');
  const reminderBtn = li.querySelector('.reminder-btn');
  const menuBtn     = li.querySelector('.menu-btn');
  const deleteBtn   = li.querySelector('.card-delete-btn');

  const titleWrap = li.querySelector('.card-title-wrap');
  titleWrap.dataset.value = titleInput.value || 'Titolo...';

  dragHandle.addEventListener('mousedown', () => { li.draggable = true; });
  li.addEventListener('dragend', () => { li.draggable = false; });

  checkBtn.addEventListener('click', e => {
    e.stopPropagation();
    updateField(todo.id, 'done', !todo.done);
  });

  titleInput.addEventListener('input', () => {
    titleWrap.dataset.value = titleInput.value || 'Titolo...';
  });
  titleInput.addEventListener('change', () => updateField(todo.id, 'title', titleInput.value));
  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); titleInput.blur(); }
  });

  preview.addEventListener('click', () => openNoteModal(todo.id));

  reminderBtn.addEventListener('click', e => {
    e.stopPropagation();
    timePicker.open(todo.time, newTime => updateField(todo.id, 'time', newTime));
  });

  deleteBtn.addEventListener('click', e => {
    e.stopPropagation();
    deleteTodo(todo.id);
  });

  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    actionSheet.open(titleInput.value || '(senza titolo)', [
      { key: 'note',   svgIcon: SVG.note,   label: 'Apri nota', handler: () => openNoteModal(todo.id) },
      { key: 'delete', svgIcon: SVG.delete, label: 'Elimina',   danger: true, handler: () => deleteTodo(todo.id) },
    ]);
  });

  li.addEventListener('dblclick', e => {
    if (e.target === titleInput) return;
    openNoteModal(todo.id);
  });

  li.addEventListener('dragstart', _onDragStart);
  li.addEventListener('dragover',  _onDragOver);
  li.addEventListener('drop',      _onDrop);
  li.addEventListener('dragend',   _onDragEnd);
  li.addEventListener('dragleave', _onDragLeave);
}

// ── CRUD ───────────────────────────────────────────────

function addTodo() {
  const todos = getTodos();
  const newTodo = {
    id:      uid(),
    title:   '',
    content: '',
    time:    '',
    accent:  todos.length % ACCENT_COUNT,
    done:    false,
    order:   0
  };
  todos.push(newTodo);
  setTodos(todos);
  renderTodos();

  const cards = document.querySelectorAll('.todo-card');
  const lastCard = cards[cards.length - 1];
  if (lastCard) {
    lastCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const titleInput = lastCard.querySelector('.card-title');
    if (titleInput) { titleInput.focus(); titleInput.select(); }
  }
}

function updateField(id, field, value) {
  const todos = getTodos();
  const t = todos.find(x => x.id === id);
  if (!t) return;
  t[field] = value;
  setTodos(todos);
  if (field === 'content' || field === 'time' || field === 'accent' || field === 'done') renderTodos();
}

function deleteTodo(id) {
  setTodos(getTodos().filter(x => x.id !== id));
  renderTodos();
}

// ── Drag & Drop ────────────────────────────────────────

function _cardIndexOf(li) {
  return [...document.querySelectorAll('.todo-card')].indexOf(li);
}

function _onDragStart(e) {
  dragSrcIndex = _cardIndexOf(this);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIndex);
}

function _onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.todo-card').forEach(c => c.classList.remove('drag-over'));
  this.classList.add('drag-over');
}

function _onDragLeave() {
  this.classList.remove('drag-over');
}

function _onDrop(e) {
  e.preventDefault();
  const destIndex = _cardIndexOf(this);
  if (dragSrcIndex === null || dragSrcIndex === destIndex) return;

  const todos = getTodos();
  const [moved] = todos.splice(dragSrcIndex, 1);
  todos.splice(destIndex, 0, moved);
  setTodos(todos);
  renderTodos();
}

function _onDragEnd() {
  document.querySelectorAll('.todo-card').forEach(c => {
    c.classList.remove('dragging', 'drag-over');
  });
  dragSrcIndex = null;
}
