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
    $dateLabel.innerHTML = `${formatDateShort(state.currentDate)}<span class="date-day-name">${i18n.t('days')[state.currentDate.getDay()]}</span>`;
  } else {
    $dateLabel.textContent = formatDate(state.currentDate);
  }
  $waterDay.textContent   = state.currentDate.getDate();
  $waterMonth.textContent = i18n.t('months')[state.currentDate.getMonth()];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = state.currentDate.getTime() === today.getTime();
  $todayChip.classList.toggle('hidden', isToday);
  $todayChip.textContent = i18n.t('today');
}

function _applyLocale() {
  document.documentElement.lang = i18n.locale;
  const $lang = document.getElementById('globalLang');
  if ($lang) { $lang.textContent = i18n.t('langLabel'); $lang.setAttribute('aria-label', i18n.t('switchLang')); }
  document.getElementById('prevDay').setAttribute('aria-label', i18n.t('prevDay'));
  document.getElementById('nextDay').setAttribute('aria-label', i18n.t('nextDay'));
  document.getElementById('currentDate').title = i18n.t('chooseDate');
  // Notes bars
  document.getElementById('nzbClearConn')?.setAttribute('aria-label', i18n.t('clearConn'));
  document.getElementById('nzbClearAll') ?.setAttribute('aria-label', i18n.t('clearAll'));
  document.getElementById('nzbSnap')     ?.setAttribute('aria-label', i18n.t('snapGrid'));
  document.getElementById('nzbGrid')     ?.setAttribute('aria-label', i18n.t('gridLayout'));
  document.getElementById('nzbHoriz')    ?.setAttribute('aria-label', i18n.t('horizLayout'));
  document.getElementById('nzbVert')     ?.setAttribute('aria-label', i18n.t('vertLayout'));
  document.getElementById('nzbPrev')     ?.setAttribute('aria-label', i18n.t('prevNote'));
  document.getElementById('nzbNext')     ?.setAttribute('aria-label', i18n.t('nextNote'));
  document.getElementById('nzbMinus')    ?.setAttribute('aria-label', i18n.t('zoomOut'));
  document.getElementById('nzbPlus')     ?.setAttribute('aria-label', i18n.t('zoomIn'));
  // Todo + task toolbar
  document.getElementById('tdClearReminders')?.setAttribute('aria-label', i18n.t('confirmClearRemindersTitle'));
  document.getElementById('tdClearAll')  ?.setAttribute('aria-label', i18n.t('confirmClearTodosTitle'));
  document.getElementById('tkResetCols') ?.setAttribute('aria-label', i18n.t('confirmResetColsTitle'));
  document.getElementById('tkClearAll')  ?.setAttribute('aria-label', i18n.t('confirmDeleteTasksTitle'));
  document.getElementById('tkFilterBtn') ?.setAttribute('aria-label', i18n.t('taskFilter'));
  // Task filter modal
  const $tfmTitle         = document.getElementById('tfmTitle');
  const $tfmLabelTitle    = document.getElementById('tfmLabelTitle');
  const $tfmSearch        = document.getElementById('tfmSearch');
  const $tfmLabelAssignee = document.getElementById('tfmLabelAssignee');
  const $tfmClear         = document.getElementById('tfmClear');
  if ($tfmTitle)         $tfmTitle.textContent         = i18n.t('taskFilter');
  if ($tfmLabelTitle)    $tfmLabelTitle.textContent    = i18n.t('taskFilterLabelTitle');
  if ($tfmSearch)        $tfmSearch.placeholder        = i18n.t('taskFilterPlaceholder');
  if ($tfmLabelAssignee) $tfmLabelAssignee.textContent = i18n.t('taskFilterLabelAssignee');
  if ($tfmClear)         $tfmClear.textContent         = i18n.t('taskFilterClear');
  // Modal buttons
  const noteSave = document.getElementById('noteSave');
  if (noteSave) noteSave.textContent = i18n.t('save');
  const noteCancel = document.getElementById('noteCancel');
  if (noteCancel) noteCancel.textContent = i18n.t('confirmCancel');
  // Modal placeholders
  const noteTitle = document.getElementById('noteModalTitle');
  if (noteTitle) noteTitle.placeholder = i18n.t('noteModalTitlePh');
  const noteContent = document.getElementById('noteContent');
  if (noteContent) noteContent.placeholder = i18n.t('noteContentPh');
  const tmTitle = document.getElementById('tmTitle');
  if (tmTitle) tmTitle.placeholder = i18n.t('taskTitleInputPh');
  const tmBody = document.getElementById('tmBody');
  if (tmBody) tmBody.placeholder = i18n.t('taskBodyPh');
  const tmTagInput = document.getElementById('tmTagInput');
  if (tmTagInput) tmTagInput.placeholder = i18n.t('taskTagInputPh');
  const tmCheckInput = document.getElementById('tmCheckInput');
  if (tmCheckInput) tmCheckInput.placeholder = i18n.t('taskCheckInputPh');
  const tmAssigneeInput = document.getElementById('tmAssigneeInput');
  if (tmAssigneeInput) tmAssigneeInput.placeholder = i18n.t('taskAssigneeInputPh');
  renderAll();
}

function _activeViewId() {
  const el = document.querySelector('.view--active');
  return el ? el.id.replace('View', '') : 'dashboard';
}

function navigateTo(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
  document.getElementById(`${view}View`).classList.add('view--active');

  const onDash  = view === 'dashboard';
  const showFab = view === 'todo' || view === 'notes' || view === 'task';
  document.getElementById('prevDay').classList.toggle('hidden', !onDash);
  document.getElementById('nextDay').classList.toggle('hidden', !onDash);
  document.getElementById('backFab').classList.toggle('hidden', onDash);
  document.getElementById('addTodo').classList.toggle('hidden', !showFab);
  document.body.classList.toggle('notes-active', view === 'notes');
  document.body.classList.toggle('todo-active',  view === 'todo');
  document.body.classList.toggle('task-active',  view === 'task');

  if (view === 'dashboard') renderDashboard();
  if (view === 'todo')      renderTodos();
  if (view === 'notes')     renderNotes();
  if (view === 'task')      renderKanban();
}

function renderAll() {
  renderHeader();
  const v = _activeViewId();
  if (v === 'dashboard') renderDashboard();
  if (v === 'todo')      renderTodos();
  if (v === 'notes')     renderNotes();
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

// ── Back FAB ───────────────────────────────────────────
document.getElementById('backFab').addEventListener('click', () => navigateTo('dashboard'));

// ── FAB ────────────────────────────────────────────────
document.getElementById('addTodo').addEventListener('click', () => {
  const v = _activeViewId();
  if (v === 'todo')  addTodo();
  if (v === 'notes') addNote();
  if (v === 'task')  addKanbanColumn();
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
  if (['notes', 'todo', 'task'].includes(_activeViewId())) return;
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
  if (['notes', 'todo', 'task'].includes(_activeViewId())) return;
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

// ── Language switcher ──────────────────────────────────
document.getElementById('globalLang')?.addEventListener('click', e => {
  e.stopPropagation();
  i18n.setLocale(i18n.nextLocale());
  _applyLocale();
});

// ── Responsive header on resize ────────────────────────
window.addEventListener('resize', renderHeader);

// ── Clock (dashboard only) ─────────────────────────────
const $clock = document.getElementById('currentTime');

function _updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  $clock.textContent = `${hh}:${mm}`;
}

_updateClock();
setInterval(_updateClock, 10000);

// ── Boot ───────────────────────────────────────────────
_applyLocale();
navigateTo('dashboard');
