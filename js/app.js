'use strict';

// ── DOM refs ───────────────────────────────────────────
const $dateLabel  = document.getElementById('currentDate');
const $waterDay   = document.getElementById('watermarkDay');
const $waterMonth = document.getElementById('watermarkMonth');
const $todayChip  = document.getElementById('goToday');

// ── Render ─────────────────────────────────────────────
function renderHeader() {
  $dateLabel.textContent  = formatDate(state.currentDate);
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
  document.getElementById('backBtn').classList.toggle('hidden', onDash);
  document.getElementById('addTodo').classList.toggle('hidden', view !== 'todo');

  if (view === 'dashboard') renderDashboard();
  if (view === 'todo')      renderTodos();
}

function renderAll() {
  renderHeader();
  const v = _activeViewId();
  if (v === 'dashboard') renderDashboard();
  if (v === 'todo')      renderTodos();
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
document.getElementById('addTodo').addEventListener('click', addTodo);

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

document.addEventListener('touchstart', e => {
  _swipeX = e.touches[0].clientX;
  _swipeY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - _swipeX;
  const dy = e.changedTouches[0].clientY - _swipeY;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  _changeDayAnimated(dx < 0 ? 1 : -1);
}, { passive: true });

// ── Trackpad / wheel horizontal swipe ──────────────────
let _wheelAccX  = 0;
let _wheelTimer = null;

document.addEventListener('wheel', e => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 0.8) return;
  if (_dayChangeBusy) { e.preventDefault(); return; }
  e.preventDefault();

  _wheelAccX += e.deltaX;

  const $m    = document.querySelector('.main');
  const shift = Math.sign(_wheelAccX) * Math.min(Math.abs(_wheelAccX) * 0.35, 100);
  $m.style.transition = 'none';
  $m.style.transform  = `translateX(${-shift}px)`;
  $m.style.opacity    = `${1 - Math.abs(shift) / 340}`;

  clearTimeout(_wheelTimer);
  _wheelTimer = setTimeout(() => {
    const dir = _wheelAccX > 85 ? 1 : _wheelAccX < -85 ? -1 : 0;
    _wheelAccX = 0;
    if (dir !== 0) {
      _changeDayAnimated(dir);
    } else {
      $m.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      $m.style.transform  = '';
      $m.style.opacity    = '';
      setTimeout(() => { $m.style.transition = ''; }, 200);
    }
  }, 80);
}, { passive: false });

// ── Keyboard shortcuts ─────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeNoteModal();
    calendarPicker.close();
    timePicker.close();
    actionSheet.close();
  }
  if (e.key === 'ArrowLeft'  && !isInputFocused()) _changeDayAnimated(-1);
  if (e.key === 'ArrowRight' && !isInputFocused()) _changeDayAnimated(+1);
});

// ── Boot ───────────────────────────────────────────────
document.getElementById('notesPHIcon').innerHTML = SVG.tileNotes;
renderHeader();
navigateTo('dashboard');
