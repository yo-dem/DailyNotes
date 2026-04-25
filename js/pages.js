'use strict';

const PAGES_PREFIX = 'pages_';
const PAGE_SAVE_DEBOUNCE = 300;
const PAGE_CHAR_LIMIT = 1000;

const PAGE_COLORS = ['#212121', '#d32f2f', '#1565c0', '#2e7d32', '#ef6c00', '#7b1fa2', '#c2185b', '#00838f'];

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
let _currentPages    = null;
let _saveTimer       = null;
let _lastFocused     = null;
let _currentColor    = '#d32f2f';
let _currentFontSize = 3;    // 1-7 execCommand fontSize levels
let _pageZoom        = 1.0;  // CSS zoom applied to #pagesList
let _busyReverting   = false; // guard against undo loop in overflow handler

// ── Persistence ─────────────────────────────────────────
function _scheduleSave() {
  clearTimeout(_saveTimer);
  const d     = new Date(state.currentDate);
  const pages = _currentPages;
  _saveTimer = setTimeout(() => {
    savePages(d, pages);
    _saveTimer = null;
  }, PAGE_SAVE_DEBOUNCE);
}

function _saveNow() {
  clearTimeout(_saveTimer);
  _saveTimer = null;
  savePages(state.currentDate, _currentPages);
}

// ── Caret helpers ───────────────────────────────────────
function _placeCaretEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── Char counting ───────────────────────────────────────
function _editorLen(ed) {
  return (ed.textContent || '').length;
}

function _refreshEditorState(wrap, ed) {
  const len = _editorLen(ed);
  const counter = wrap.querySelector('.page-count');
  if (counter) {
    counter.textContent = `${len} / ${PAGE_CHAR_LIMIT}`;
    counter.classList.toggle('page-count--full', len >= PAGE_CHAR_LIMIT);
  }
  // Browsers leave a stray <br> after the last char is deleted; flatten it
  // so the :empty placeholder logic stays predictable.
  if (!ed.textContent && (ed.innerHTML === '<br>' || ed.innerHTML === '')) {
    ed.innerHTML = '';
  }
  ed.classList.toggle('is-empty', len === 0);
}

// ── Render ──────────────────────────────────────────────
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

    const editor = document.createElement('div');
    editor.className          = 'page-editor';
    editor.contentEditable    = 'true';
    editor.spellcheck         = true;
    editor.dataset.placeholder = idx === 0 ? 'Scrivi qui le tue note…' : '';
    editor.innerHTML          = page.content || '';

    editor.addEventListener('focus', () => { _lastFocused = editor; });
    editor.addEventListener('beforeinput', e => _onBeforeInput(e, idx, editor));
    editor.addEventListener('paste',   e => _onPaste(e, idx, editor));
    editor.addEventListener('keydown', e => _onKeyDown(e));
    editor.addEventListener('input', () => {
      if (_busyReverting) return;

      // Visual-overflow guard: if the content is taller than the fixed page
      // height, undo the change. textContent-based char counting misses empty
      // lines (Enter presses insert block elements with 0 textContent length).
      if (editor.scrollHeight > editor.clientHeight) {
        _busyReverting = true;
        document.execCommand('undo');
        _busyReverting = false;
        // Fallback if there's no undo history (e.g. very first keystroke)
        if (editor.scrollHeight > editor.clientHeight) {
          editor.innerHTML = page.content || '';
        }
        _refreshEditorState(wrap, editor);
        page.content = editor.innerHTML;
        _scheduleSave();
        return;
      }

      _refreshEditorState(wrap, editor);
      page.content = editor.innerHTML;
      _scheduleSave();
    });

    const meta = document.createElement('div');
    meta.className = 'page-meta';
    meta.innerHTML = `
      <span class="page-count">0 / ${PAGE_CHAR_LIMIT}</span>
      <span class="page-num">${idx + 1} / ${pages.length}</span>
    `;

    const del = document.createElement('button');
    del.className = 'page-del';
    del.title     = 'Elimina pagina';
    del.innerHTML = SVG.cross;
    del.addEventListener('click', () => _deletePage(idx));

    wrap.appendChild(editor);
    wrap.appendChild(meta);
    wrap.appendChild(del);
    $list.appendChild(wrap);

    // Initial counter + placeholder state
    _refreshEditorState(wrap, editor);
  });

  _wireToolbarOnce();
  _refreshColorSwatch();
  _applyPageZoom();
  _refreshToolbarState();
}

// ── Char-limit handling ─────────────────────────────────
function _ensureNextPage(idx) {
  if (idx + 1 < _currentPages.length) {
    return document.querySelectorAll('.page-editor')[idx + 1];
  }
  // Append a fresh page and re-render
  _currentPages.push({ id: uid(), content: '' });
  _saveNow();
  renderPages();
  return document.querySelectorAll('.page-editor')[idx + 1];
}

function _onBeforeInput(e, idx, editor) {
  // Allow deletions, formatting, and historyUndo/Redo
  if (!e.inputType.startsWith('insert')) return;

  const len = _editorLen(editor);
  const add = e.data ? e.data.length : 1;
  if (len + add <= PAGE_CHAR_LIMIT) return;

  e.preventDefault();
  const nextEd = _ensureNextPage(idx);
  if (!nextEd) return;
  nextEd.focus();
  _placeCaretEnd(nextEd);
  if (e.data) document.execCommand('insertText', false, e.data);
}

function _onPaste(e, idx, editor) {
  // Force plain text and respect char limit by spilling overflow to next pages
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;

  let remaining = text;
  let curIdx = idx;
  let curEd  = editor;

  while (remaining.length > 0) {
    const space = Math.max(0, PAGE_CHAR_LIMIT - _editorLen(curEd));
    if (space > 0) {
      const chunk = remaining.slice(0, space);
      remaining   = remaining.slice(space);
      curEd.focus();
      document.execCommand('insertText', false, chunk);
    }
    if (remaining.length > 0) {
      curEd = _ensureNextPage(curIdx);
      if (!curEd) break;
      curIdx++;
      _placeCaretEnd(curEd);
    }
  }
}

function _onKeyDown(e) {
  // Tab → indent / Shift+Tab → outdent for nested lists
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand(e.shiftKey ? 'outdent' : 'indent');
  }
}

// ── Add / Delete ────────────────────────────────────────
function addPage() {
  if (!_currentPages) _currentPages = loadPages(state.currentDate);
  _currentPages.push({ id: uid(), content: '' });
  _saveNow();
  renderPages();

  requestAnimationFrame(() => {
    const all = document.querySelectorAll('.page-editor');
    if (!all.length) return;
    const last = all[all.length - 1];
    last.focus();
    last.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function _deletePage(idx) {
  if (!_currentPages) _currentPages = loadPages(state.currentDate);
  const target = _currentPages[idx];
  const empty  = !target || !(target.content || '').replace(/<[^>]*>/g, '').trim();

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

// ── Toolbar state (active buttons + cursor color) ───────
//
// _cmdOverride: after a toolbar click, queryCommandState can't reflect the
// typing-override state (it sees surrounding text, not future-char intent).
// We store the toggled state here and use it until the cursor actually moves.
// _blockSelChange: suppresses the selectionchange(s) fired by execCommand
// itself, so they don't immediately clear the override we just set.
const _cmdOverride  = {};   // 'bold'|'italic'|'strikeThrough' → true/false
let   _blockSelChange = false;

function _refreshToolbarState() {
  const $tb = document.getElementById('pageToolbar');
  if (!$tb) return;

  const sel      = window.getSelection();
  const inEditor = !!(sel && sel.anchorNode &&
    sel.anchorNode.parentElement?.closest('.page-editor'));

  ['bold', 'italic', 'strikeThrough'].forEach(cmd => {
    const btn = $tb.querySelector(`[data-cmd="${cmd}"]`);
    if (!btn) return;
    const active = cmd in _cmdOverride
      ? _cmdOverride[cmd]
      : !!(inEditor && document.queryCommandState(cmd));
    btn.classList.toggle('ptb-btn--active', active);
  });

  const sw = document.getElementById('ptbColorSwatch');
  if (sw) {
    const cursorColor = inEditor ? document.queryCommandValue('foreColor') : '';
    sw.style.background = (cursorColor && cursorColor !== 'false') ? cursorColor : _currentColor;
  }
}

// ── Page zoom ────────────────────────────────────────────
function _applyPageZoom() {
  const list = document.getElementById('pagesList');
  if (list) list.style.zoom = _pageZoom;
}

// ── Toolbar ─────────────────────────────────────────────
let _toolbarWired = false;
function _wireToolbarOnce() {
  if (_toolbarWired) return;
  _toolbarWired = true;

  const $tb = document.getElementById('pageToolbar');
  if (!$tb) return;

  // Inject SVG icons into the list buttons
  $tb.querySelector('[data-cmd="insertUnorderedList"]').innerHTML = SVG.listUl;
  $tb.querySelector('[data-cmd="insertOrderedList"]').innerHTML   = SVG.listOl;

  // Format buttons (use pointerdown + preventDefault so editor selection survives)
  $tb.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      _ensureFocus();
      const wasActive = document.queryCommandState(cmd);
      document.execCommand(cmd, false, null);
      _persistFocused();
      // For toggle commands, track the intended state so _refreshToolbarState
      // doesn't get overridden by the selectionchange execCommand triggers.
      if (cmd === 'bold' || cmd === 'italic' || cmd === 'strikeThrough') {
        _cmdOverride[cmd] = !wasActive;
        _blockSelChange   = true;
        _refreshToolbarState();
        requestAnimationFrame(() => { _blockSelChange = false; });
      }
    });
  });

  // Color picker
  const $colBtn = document.getElementById('ptbColor');
  const $colPop = document.getElementById('ptbColorPop');
  PAGE_COLORS.forEach(c => {
    const dot = document.createElement('button');
    dot.className     = 'ptb-color-dot';
    dot.style.background = c;
    dot.dataset.color = c;
    dot.addEventListener('pointerdown', e => {
      e.preventDefault();
      _ensureFocus();
      document.execCommand('foreColor', false, c);
      _currentColor = c;
      _refreshColorSwatch();
      $colPop.classList.add('hidden');
      _persistFocused();
    });
    $colPop.appendChild(dot);
  });

  $colBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    $colPop.classList.toggle('hidden');
  });

  // Close popover on outside click
  document.addEventListener('pointerdown', e => {
    if ($colPop.classList.contains('hidden')) return;
    if (e.target.closest('#ptbColorPop') || e.target.closest('#ptbColor')) return;
    $colPop.classList.add('hidden');
  });

  // Font-size buttons
  const $fontInc = document.getElementById('ptbFontInc');
  const $fontDec = document.getElementById('ptbFontDec');
  if ($fontInc) {
    $fontInc.addEventListener('pointerdown', e => {
      e.preventDefault();
      _ensureFocus();
      _currentFontSize = Math.min(7, _currentFontSize + 1);
      document.execCommand('fontSize', false, String(_currentFontSize));
      _persistFocused();
    });
  }
  if ($fontDec) {
    $fontDec.addEventListener('pointerdown', e => {
      e.preventDefault();
      _ensureFocus();
      _currentFontSize = Math.max(1, _currentFontSize - 1);
      document.execCommand('fontSize', false, String(_currentFontSize));
      _persistFocused();
    });
  }

  // Zoom buttons
  const $zoomIn  = document.getElementById('ptbZoomIn');
  const $zoomOut = document.getElementById('ptbZoomOut');
  if ($zoomIn)  $zoomIn.innerHTML  = SVG.zoomIn;
  if ($zoomOut) $zoomOut.innerHTML = SVG.zoomOut;
  $zoomIn?.addEventListener('pointerdown', e => {
    e.preventDefault();
    _pageZoom = Math.min(2.0, parseFloat((_pageZoom + 0.15).toFixed(2)));
    _applyPageZoom();
  });
  $zoomOut?.addEventListener('pointerdown', e => {
    e.preventDefault();
    _pageZoom = Math.max(0.4, parseFloat((_pageZoom - 0.15).toFixed(2)));
    _applyPageZoom();
  });

  // Track cursor formatting → refresh button active states.
  // When _blockSelChange is true the event was caused by our own execCommand,
  // not by real cursor movement, so we skip it (override is already correct).
  document.addEventListener('selectionchange', () => {
    if (_blockSelChange) return;
    // Cursor moved for real → typing-override is gone, use live queryCommandState
    Object.keys(_cmdOverride).forEach(k => delete _cmdOverride[k]);
    _refreshToolbarState();
  });
}

function _ensureFocus() {
  if (_lastFocused && document.body.contains(_lastFocused)) {
    _lastFocused.focus();
    return;
  }
  const first = document.querySelector('.page-editor');
  if (first) { first.focus(); _lastFocused = first; }
}

function _persistFocused() {
  // After a format command, sync the active editor back into the page model
  const ed = _lastFocused;
  if (!ed) return;
  const editors = [...document.querySelectorAll('.page-editor')];
  const idx = editors.indexOf(ed);
  if (idx < 0 || !_currentPages[idx]) return;
  _currentPages[idx].content = ed.innerHTML;
  _scheduleSave();
}

function _refreshColorSwatch() {
  const sw = document.getElementById('ptbColorSwatch');
  if (sw) sw.style.background = _currentColor;
}
