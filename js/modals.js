'use strict';

let _editingNoteId = null;

const $noteModal   = document.getElementById('noteModal');
const $noteTitle   = document.getElementById('noteModalTitle');
const $noteContent = document.getElementById('noteContent');
const $noteColors  = document.getElementById('noteColors');

function openNoteModal(id) {
  const t = getTodos().find(x => x.id === id);
  if (!t) return;
  _editingNoteId = id;

  const accentIdx = typeof t.accent === 'number' ? t.accent : 0;
  $noteTitle.value = t.title || '';
  $noteTitle.style.color = ACCENT_COLORS[accentIdx];
  $noteContent.value = t.content || '';

  _renderColorPicker(accentIdx);

  $noteModal.classList.remove('hidden');
  setTimeout(() => $noteContent.focus(), 60);
}

function _renderColorPicker(selectedIdx) {
  $noteColors.innerHTML = ACCENT_COLORS.map((color, i) => `
    <button class="note-color-swatch${i === selectedIdx ? ' selected' : ''}"
            data-idx="${i}"
            style="--swatch-color: ${color}; --swatch-bg: ${PASTEL_BG[i]};"
            title="Colore ${i + 1}">
    </button>
  `).join('');

  $noteColors.querySelectorAll('.note-color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (!_editingNoteId) return;
      updateField(_editingNoteId, 'accent', idx);
      $noteTitle.style.color = ACCENT_COLORS[idx];
      $noteColors.querySelectorAll('.note-color-swatch').forEach(b =>
        b.classList.toggle('selected', parseInt(b.dataset.idx, 10) === idx)
      );
    });
  });
}

function closeNoteModal() {
  $noteModal.classList.add('hidden');
  _editingNoteId = null;
}

document.getElementById('noteSave').addEventListener('click', () => {
  if (!_editingNoteId) return;
  updateField(_editingNoteId, 'title', $noteTitle.value.trim());
  updateField(_editingNoteId, 'content', $noteContent.value);
  closeNoteModal();
});

document.getElementById('noteCancel').addEventListener('click', closeNoteModal);

$noteModal.addEventListener('click', e => {
  if (e.target === $noteModal) closeNoteModal();
});
