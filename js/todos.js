'use strict';

let _todoDrag = null;

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

  dragHandle.addEventListener('pointerdown', _onTodoDragHandle);

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

// ── Pointer Drag & Drop ────────────────────────────────

function _onTodoDragHandle(e) {
  if (e.button !== 0) return;
  if (_todoDrag) return;
  e.preventDefault();

  const card = e.currentTarget.closest('.todo-card');
  if (!card) return;
  card.setPointerCapture(e.pointerId);

  const $list = document.getElementById('todoList');
  const cards = [...$list.querySelectorAll('.todo-card')];

  // Reset any lingering transforms and capture original slot rects
  cards.forEach(c => { c.style.transition = 'none'; c.style.transform = ''; });
  const slotRects = cards.map(c => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });

  const srcIdx = cards.indexOf(card);
  const sr     = slotRects[srcIdx];

  // Floating clone that follows the pointer
  const clone = card.cloneNode(true);
  Object.assign(clone.style, {
    position:      'fixed',
    left:          `${sr.left}px`,
    top:           `${sr.top}px`,
    width:         `${sr.width}px`,
    height:        `${sr.height}px`,
    margin:        '0',
    zIndex:        '2000',
    pointerEvents: 'none',
    willChange:    'top',
    transition:    'transform 0.15s ease, box-shadow 0.15s ease',
    transform:     'scale(1.03)',
    boxShadow:     '0 24px 52px rgba(0,0,0,0.32)',
  });
  document.body.appendChild(clone);

  card.classList.add('todo-card--ghost');

  _todoDrag = {
    card,
    clone,
    srcIdx,
    slotRects,
    nearestIdx:   srcIdx,
    currentOrder: getTodos().map(t => t.id),
    ox: e.clientX - sr.left,
    oy: e.clientY - sr.top,
    moved: false,
  };

  card.addEventListener('pointermove',        _onTodoPointerMove);
  card.addEventListener('pointerup',          _onTodoPointerUp);
  card.addEventListener('pointercancel',      _onTodoPointerUp);
  card.addEventListener('lostpointercapture', _onTodoLostCapture);
}

function _onTodoPointerMove(e) {
  if (!_todoDrag) return;
  const { clone, slotRects, srcIdx, oy, card } = _todoDrag;

  const y = e.clientY - oy;

  if (!_todoDrag.moved) {
    const dy = e.clientY - (slotRects[srcIdx].top + oy);
    if (Math.abs(dy) < 8) return;
    _todoDrag.moved = true;
  }

  clone.style.left = `${e.clientX - _todoDrag.ox}px`;
  clone.style.top  = `${y}px`;

  // Center of the floating clone
  const cloneCenterY = y + slotRects[srcIdx].height / 2;

  // Find the nearest original slot
  let nearestIdx = srcIdx;
  let minDist    = Infinity;
  slotRects.forEach((r, i) => {
    const d = Math.abs(cloneCenterY - (r.top + r.height / 2));
    if (d < minDist) { minDist = d; nearestIdx = i; }
  });

  if (nearestIdx === _todoDrag.nearestIdx) return;
  _todoDrag.nearestIdx = nearestIdx;

  // Recompute conceptual order
  const ids      = getTodos().map(t => t.id);
  const newOrder = [...ids];
  const [moved]  = newOrder.splice(srcIdx, 1);
  newOrder.splice(nearestIdx, 0, moved);
  _todoDrag.currentOrder = newOrder;

  // Translate other cards to their new slots
  const $list = document.getElementById('todoList');
  [...$list.querySelectorAll('.todo-card')].forEach((c, domIdx) => {
    if (c === card) return;
    const targetIdx = newOrder.indexOf(c.dataset.id);
    const tr = slotRects[targetIdx];
    const cr = slotRects[domIdx];
    c.style.transition = 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)';
    c.style.transform  = `translateY(${tr.top - cr.top}px)`;
  });
}

function _onTodoPointerUp() {
  if (!_todoDrag) return;

  const { card, clone, currentOrder, slotRects, moved } = _todoDrag;

  card.removeEventListener('pointermove',        _onTodoPointerMove);
  card.removeEventListener('pointerup',          _onTodoPointerUp);
  card.removeEventListener('pointercancel',      _onTodoPointerUp);
  card.removeEventListener('lostpointercapture', _onTodoLostCapture);

  if (!moved) {
    clone.remove();
    card.classList.remove('todo-card--ghost');
    _todoDrag = null;
    return;
  }

  // Animate clone landing on its final slot
  const finalIdx = currentOrder.indexOf(card.dataset.id);
  const fr       = slotRects[finalIdx];

  clone.style.transition = 'left 0.2s ease, top 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease';
  clone.style.left       = `${fr.left}px`;
  clone.style.top        = `${fr.top}px`;
  clone.style.transform  = 'scale(1)';
  clone.style.boxShadow  = '0 4px 16px rgba(0,0,0,0.12)';

  const thisDrag = _todoDrag;
  setTimeout(() => {
    clone.remove();
    if (_todoDrag === thisDrag) {
      _todoDrag = null;
      const todos     = getTodos();
      const reordered = currentOrder.map(id => todos.find(t => t.id === id)).filter(Boolean);
      setTodos(reordered);
      renderTodos();
    }
  }, 200);
}

function _onTodoLostCapture() {
  // Fires only if pointerup/cancel never removed this listener — force cleanup
  if (!_todoDrag || _todoDrag.card !== this) return;
  const { card, clone } = _todoDrag;
  card.removeEventListener('pointermove',   _onTodoPointerMove);
  card.removeEventListener('pointerup',     _onTodoPointerUp);
  card.removeEventListener('pointercancel', _onTodoPointerUp);
  clone.remove();
  card.classList.remove('todo-card--ghost');
  document.querySelectorAll('.todo-card').forEach(c => {
    c.style.transition = '';
    c.style.transform  = '';
  });
  _todoDrag = null;
}
