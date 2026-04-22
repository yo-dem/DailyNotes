'use strict';

const _fired = new Set();

// ── Audio ──────────────────────────────────────────────
function _playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[0, 660], [0.35, 880], [0.7, 660]].forEach(([offset, freq]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.28, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.28);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.3);
    });
  } catch (_) {}
}

// ── Alarm Modal ────────────────────────────────────────
class AlarmModal {
  constructor() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'alarm-overlay';
    this._el = document.createElement('div');
    this._el.className = 'alarm-modal';
    this._el.addEventListener('click', e => e.stopPropagation());
    document.body.appendChild(this._overlay);
    document.body.appendChild(this._el);
    this._alarmInterval = null;
  }

  open(todo, todoDate, firedKey) {
    this._el.innerHTML = `
      <div class="alarm-icon">${SVG.clock}</div>
      <div class="alarm-time">${todo.time}</div>
      <div class="alarm-title">${escHtml(todo.title || '(senza titolo)')}</div>
      <div class="alarm-actions">
        <button class="alarm-btn alarm-btn--dismiss" data-action="dismiss">
          <span class="alarm-btn-icon">${SVG.cross}</span>
          <span>Elimina</span>
        </button>
        <button class="alarm-btn alarm-btn--snooze" data-action="snooze">
          <span class="alarm-btn-icon">${SVG.clock}</span>
          <span>+5 min</span>
        </button>
        <button class="alarm-btn alarm-btn--goto" data-action="goto">
          <span class="alarm-btn-icon">${SVG.goto}</span>
          <span>Vai</span>
        </button>
      </div>
    `;

    this._el.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
      _clearTime(todo.id, todoDate);
      this.close();
    });
    this._el.querySelector('[data-action="snooze"]').addEventListener('click', () => {
      _snooze(todo, todoDate, firedKey);
      this.close();
    });
    this._el.querySelector('[data-action="goto"]').addEventListener('click', () => {
      this.close();
      _gotoTodo(todo.id, todoDate);
    });

    this._overlay.classList.add('open');
    this._el.classList.add('open');
    this._alarmInterval = setInterval(_playAlarm, 3000);
  }

  close() {
    clearInterval(this._alarmInterval);
    this._alarmInterval = null;
    this._overlay.classList.remove('open');
    this._el.classList.remove('open');
  }
}

const alarmModal = new AlarmModal();

// ── Actions ────────────────────────────────────────────
function _clearTime(id, d) {
  const todos = loadTodos(d);
  const t = todos.find(x => x.id === id);
  if (!t) return;
  t.time = '';
  saveTodos(d, todos);
  if (dateKey(state.currentDate) === dateKey(d)) renderTodos();
}

function _snooze(todo, d, firedKey) {
  const [h, m] = todo.time.split(':').map(Number);
  const nd = new Date();
  nd.setHours(h, m + 5, 0, 0);
  const newTime = `${String(nd.getHours()).padStart(2,'0')}:${String(nd.getMinutes()).padStart(2,'0')}`;
  const todos = loadTodos(d);
  const t = todos.find(x => x.id === todo.id);
  if (!t) return;
  t.time = newTime;
  saveTodos(d, todos);
  _fired.delete(firedKey);
  if (dateKey(state.currentDate) === dateKey(d)) renderTodos();
}

function _gotoTodo(id, d) {
  state.currentDate = new Date(d);
  renderAll();
  setTimeout(() => {
    const card = document.querySelector(`.todo-card[data-id="${id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('alarm-highlight');
    setTimeout(() => card.classList.remove('alarm-highlight'), 2000);
  }, 120);
}

// ── Polling — scansiona TUTTI i giorni in localStorage ──
function _checkReminders() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;

    try {
      const todos = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(todos)) continue;
      const [y, mo, d] = key.split('-').map(Number);
      const todoDate = new Date(y, mo - 1, d);

      todos.forEach(todo => {
        if (!todo.time) return;
        const firedKey = `${key}:${todo.id}`;
        if (todo.time === currentTime && !_fired.has(firedKey)) {
          _fired.add(firedKey);
          _playAlarm();
          alarmModal.open(todo, todoDate, firedKey);
        }
      });
    } catch (_) {}
  }
}

setInterval(_checkReminders, 30_000);
_checkReminders();
