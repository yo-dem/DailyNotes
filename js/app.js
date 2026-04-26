'use strict';

// ── DOM refs ───────────────────────────────────────────
const $dateLabel  = document.getElementById('currentDate');
const $waterDay   = document.getElementById('watermarkDay');
const $waterMonth = document.getElementById('watermarkMonth');
const $todayChip  = document.getElementById('goToday');

// ── Render ─────────────────────────────────────────────
function renderHeader() {
  const narrow = window.innerWidth < 360;
  if (narrow) {
    $dateLabel.innerHTML = `${formatDateShort(state.currentDate)}<span class="date-day-name">${DAYS_IT[state.currentDate.getDay()]}</span>`;
  } else {
    $dateLabel.textContent = formatDate(state.currentDate);
  }
  $waterDay.textContent   = state.currentDate.getDate();
  $waterMonth.textContent = MONTHS_IT[state.currentDate.getMonth()];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = state.currentDate.getTime() === today.getTime();
  $todayChip.classList.toggle('hidden', isToday);
}

function _activeViewId() {
  const el = document.querySelector('.view--active');
  return el ? el.id.replace('View', '') : 'dashboard';
}

function navigateTo(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
  document.getElementById(`${view}View`).classList.add('view--active');

  const onDash = view === 'dashboard';
  const showFab = view === 'todo' || view === 'notes' || view === 'pages' || view === 'task';
  document.getElementById('prevDay').classList.toggle('hidden', !onDash);
  document.getElementById('nextDay').classList.toggle('hidden', !onDash);
  document.getElementById('bottomDock').classList.toggle('hidden', onDash);
  document.getElementById('addTodo').classList.toggle('hidden', !showFab);
  document.body.classList.toggle('notes-active', view === 'notes');
  document.body.classList.toggle('todo-active',  view === 'todo');
  document.body.classList.toggle('pages-active', view === 'pages');
  document.body.classList.toggle('task-active',  view === 'task');

  if (view === 'dashboard') renderDashboard();
  if (view === 'todo')      renderTodos();
  if (view === 'notes')     renderNotes();
  if (view === 'pages')     renderPages();
  if (view === 'task')      renderKanban();
}

function renderAll() {
  renderHeader();
  const v = _activeViewId();
  if (v === 'dashboard') renderDashboard();
  if (v === 'todo')      renderTodos();
  if (v === 'notes')     renderNotes();
  if (v === 'pages')     renderPages();
  if (v === 'task')      renderKanban();
}

// ── Navigation ─────────────────────────────────────────
document.getElementById('prevDay').addEventListener('click', () => _changeDayAnimated(-1));
document.getElementById('nextDay').addEventListener('click', () => _changeDayAnimated(+1));

$dateLabel.addEventListener('click', () => {
  calendarPicker.open(state.currentDate, picked => {
    state.currentDate = picked;
    renderAll();
  });
});

$todayChip.addEventListener('click', e => {
  e.stopPropagation();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  state.currentDate = today;
  renderAll();
});

// ── Back button ────────────────────────────────────────
document.getElementById('backBtn').addEventListener('click', () => navigateTo('dashboard'));

// ── FAB ────────────────────────────────────────────────
document.getElementById('addTodo').addEventListener('click', () => {
  const v = _activeViewId();
  if (v === 'todo')  addTodo();
  if (v === 'notes') addNote();
  if (v === 'pages') addPage();
  if (v === 'task')  addKanbanTask();
});

// ── Animated day change (shared by swipe + wheel + arrows) ─
let _dayChangeBusy = false;

function _changeDayAnimated(dir) {
  if (_dayChangeBusy) return;
  _dayChangeBusy = true;
  const $m = document.querySelector('.main');
  $m.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
  $m.style.transform  = `translateX(${dir > 0 ? '-12%' : '12%'})`;
  $m.style.opacity    = '0';
  setTimeout(() => {
    state.currentDate = shiftDate(state.currentDate, dir);
    renderAll();
    $m.style.transition = 'none';
    $m.style.transform  = `translateX(${dir > 0 ? '10%' : '-10%'})`;
    $m.style.opacity    = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $m.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
      $m.style.transform  = '';
      $m.style.opacity    = '';
      setTimeout(() => { $m.style.transition = ''; _dayChangeBusy = false; }, 220);
    }));
  }, 180);
}

// ── Touch swipe ────────────────────────────────────────
let _swipeX = 0;
let _swipeY = 0;
let _swipeOnTile = false;

document.addEventListener('touchstart', e => {
  _swipeX = e.touches[0].clientX;
  _swipeY = e.touches[0].clientY;
  _swipeOnTile = !!e.target.closest('.dash-tile');
}, { passive: true });

document.addEventListener('touchend', e => {
  if (['notes', 'todo', 'pages', 'task'].includes(_activeViewId())) return;
  if (_swipeOnTile) return;
  const dx = e.changedTouches[0].clientX - _swipeX;
  const dy = e.changedTouches[0].clientY - _swipeY;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  _changeDayAnimated(dx < 0 ? 1 : -1);
}, { passive: true });

// ── Trackpad / wheel horizontal swipe ──────────────────
let _wheelAccX    = 0;
let _wheelTimer   = null;
let _wheelCooling = false;
let _wheelCoolPrev = 0; // last deltaX seen during cooling (to detect re-acceleration)

document.addEventListener('wheel', e => {
  if (['notes', 'todo', 'pages', 'task'].includes(_activeViewId())) return;
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.8) return;
  e.preventDefault();
  if (_dayChangeBusy) return;

  // After a day change, swallow momentum until deltaX starts growing again
  // (momentum = decreasing; new deliberate swipe = accelerating)
  if (_wheelCooling) {
    const growing  = Math.abs(e.deltaX) >= Math.abs(_wheelCoolPrev) + 1;
    const reversed = Math.sign(e.deltaX) !== Math.sign(_wheelCoolPrev) && Math.abs(e.deltaX) > 5;
    if (growing || reversed) {
      _wheelCooling = false;
      _wheelAccX    = 0;
      // fall through and treat this event as the start of a new gesture
    } else {
      _wheelCoolPrev = e.deltaX;
      return;
    }
  }

  _wheelAccX += e.deltaX;

  const $m    = document.querySelector('.main');
  const shift = Math.sign(_wheelAccX) * Math.min(Math.abs(_wheelAccX) * 0.5, 100);
  $m.style.transition = 'none';
  $m.style.transform  = `translateX(${-shift}px)`;
  $m.style.opacity    = `${1 - Math.abs(shift) / 320}`;

  // commit as soon as threshold is reached — no waiting for scroll end
  if (Math.abs(_wheelAccX) > 60) {
    const dir = _wheelAccX > 0 ? 1 : -1;
    _wheelAccX     = 0;
    _wheelCooling  = true;
    _wheelCoolPrev = e.deltaX;
    clearTimeout(_wheelTimer);
    _changeDayAnimated(dir);
    return;
  }

  // snap back if scroll stops below threshold
  clearTimeout(_wheelTimer);
  _wheelTimer = setTimeout(() => {
    _wheelAccX = 0;
    $m.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    $m.style.transform  = '';
    $m.style.opacity    = '';
    setTimeout(() => { $m.style.transition = ''; }, 200);
  }, 160);
}, { passive: false });

// ── Keyboard shortcuts ─────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeNoteModal();
    calendarPicker.close();
    timePicker.close();
    actionSheet.close();
  }
  if (e.key === 'ArrowLeft'  && !isInputFocused() && _activeViewId() === 'dashboard') _changeDayAnimated(-1);
  if (e.key === 'ArrowRight' && !isInputFocused() && _activeViewId() === 'dashboard') _changeDayAnimated(+1);
});

// ── Responsive header on resize ────────────────────────
window.addEventListener('resize', renderHeader);

// ── Boot ───────────────────────────────────────────────
renderHeader();
navigateTo('dashboard');
