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

function renderAll() {
  renderHeader();
  renderTodos();
}

// ── Navigation ─────────────────────────────────────────
document.getElementById('prevDay').addEventListener('click', () => {
  state.currentDate = shiftDate(state.currentDate, -1);
  renderAll();
});

document.getElementById('nextDay').addEventListener('click', () => {
  state.currentDate = shiftDate(state.currentDate, +1);
  renderAll();
});

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

// ── FAB ────────────────────────────────────────────────
document.getElementById('addTodo').addEventListener('click', addTodo);

// ── Keyboard shortcuts ─────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeNoteModal();
    calendarPicker.close();
    timePicker.close();
    actionSheet.close();
  }
  if (e.key === 'ArrowLeft' && !isInputFocused()) {
    state.currentDate = shiftDate(state.currentDate, -1);
    renderAll();
  }
  if (e.key === 'ArrowRight' && !isInputFocused()) {
    state.currentDate = shiftDate(state.currentDate, +1);
    renderAll();
  }
});

// ── Boot ───────────────────────────────────────────────
renderAll();
