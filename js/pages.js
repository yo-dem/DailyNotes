'use strict';

const PAGES_PREFIX = 'pages_';
const PAGE_SAVE_DEBOUNCE = 300;

function _pagesKey(d) { return PAGES_PREFIX + dateKey(d); }

function loadPages(d) {
  try {
    const raw = localStorage.getItem(_pagesKey(d));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function savePages(d, pages) {
  localStorage.setItem(_pagesKey(d), JSON.stringify(pages));
}

// In-memory source of truth for the currently-rendered view.
// Input handlers mutate this directly so pending typing isn't lost when
// add/delete operations re-read state from storage.
let _currentPages = null;
let _saveTimer = null;

function _scheduleSave() {
  clearTimeout(_saveTimer);
  // Capture date+ref now so a date change won't redirect a pending save
  const d = new Date(state.currentDate);
  const pages = _currentPages;
  _saveTimer = setTimeout(() => {
    savePages(d, pages);
    _saveTimer = null;
  }, PAGE_SAVE_DEBOUNCE);
}

function renderPages() {
  const $list = document.getElementById('pagesList');
  if (!$list) return;

  let pages = loadPages(state.currentDate);
  if (!pages.length) {
    pages = [{ id: uid(), content: '' }];
    savePages(state.currentDate, pages);
  }
  _currentPages = pages;

  $list.innerHTML = '';

  pages.forEach((page, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'page';

    const ta = document.createElement('textarea');
    ta.className = 'page-textarea';
    ta.value = page.content || '';
    ta.placeholder = idx === 0 ? 'Scrivi qui le tue note…' : '';
    ta.spellcheck = true;
    ta.addEventListener('input', () => {
      page.content = ta.value;
      _scheduleSave();
    });

    const num = document.createElement('div');
    num.className = 'page-num';
    num.textContent = `${idx + 1} / ${pages.length}`;

    const del = document.createElement('button');
    del.className = 'page-del';
    del.title = 'Elimina pagina';
    del.innerHTML = SVG.delete;
    del.addEventListener('click', () => _deletePage(idx));

    wrap.appendChild(ta);
    wrap.appendChild(num);
    wrap.appendChild(del);
    $list.appendChild(wrap);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'page-add';
  addBtn.textContent = '+ Aggiungi pagina';
  addBtn.addEventListener('click', addPage);
  $list.appendChild(addBtn);
}

function addPage() {
  // _currentPages already holds the latest in-memory edits (mutated by input handlers)
  if (!_currentPages) _currentPages = loadPages(state.currentDate);
  _currentPages.push({ id: uid(), content: '' });
  clearTimeout(_saveTimer);
  _saveTimer = null;
  savePages(state.currentDate, _currentPages);
  renderPages();

  requestAnimationFrame(() => {
    const all = document.querySelectorAll('.page-textarea');
    if (!all.length) return;
    const last = all[all.length - 1];
    last.focus();
    last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function _deletePage(idx) {
  if (!_currentPages) _currentPages = loadPages(state.currentDate);
  const target = _currentPages[idx];
  const empty  = !target || !(target.content || '').trim();

  const doDelete = () => {
    clearTimeout(_saveTimer);
    _saveTimer = null;
    if (_currentPages.length <= 1) {
      _currentPages[0] = { id: uid(), content: '' };
    } else {
      _currentPages.splice(idx, 1);
    }
    savePages(state.currentDate, _currentPages);
    renderPages();
  };

  if (empty) { doDelete(); return; }

  showConfirm({
    title: 'Eliminare pagina?',
    message: 'Il contenuto sarà perso definitivamente.',
    confirmLabel: 'Elimina',
    danger: true,
    onConfirm: doDelete,
  });
}
