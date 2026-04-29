# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DailyNotes is a single-page, zero-dependency personal productivity app (Italian UI) that runs entirely in the browser with no build step. All data is persisted in `localStorage`. There is no server, no package manager, no bundler.

To develop: open `index.html` directly in a browser (file:// works) or serve with any static file server:
```
npx serve .
# or
python3 -m http.server
```

## Architecture

The app is structured as a collection of plain JS files loaded in dependency order via `<script>` tags in `index.html`. There is no module system — all functions and variables are global.

**Script load order (from index.html):**
1. `js/utils.js` — constants (Italian date names, accent palettes, SVG icons), helpers (`uid`, `escHtml`, `dateKey`, `shiftDate`, `showConfirm`)
2. `js/storage.js` — `loadTodos` / `saveTodos` (localStorage wrappers keyed by `dateKey`)
3. `js/state.js` — single `state` object with `currentDate`; `getTodos()` / `setTodos()` delegates to storage
4. `js/calendar.js` — `calendarPicker` singleton injected into DOM
5. `js/timepicker.js` — `timePicker` singleton
6. `js/actionsheet.js` — `actionSheet` singleton (bottom sheet menu)
7. `js/todos.js` — to-do list CRUD and rendering
8. `js/modals.js` — shared modal open/close logic (`closeNoteModal`)
9. `js/dashboard.js` — 4-tile dashboard with drag-to-reorder; tile tap calls `navigateTo()`
10. `js/notes.js` — freeform post-it canvas (zoomable, drag-to-connect)
11. `js/pages.js` — multi-page rich text notes (`contenteditable`); `loadPages` / `savePages`
12. `js/tasks.js` — Kanban board (columns + task cards); global tags and assignees stored in `localStorage`
13. `js/app.js` — `navigateTo()`, `renderAll()`, header rendering, swipe/wheel/keyboard navigation, boot
14. `js/reminder.js` — reminder/notification logic (loaded last)

**Views** (defined in `index.html`, toggled by `navigateTo()`):
- `dashboard` → `#dashboardView` — entry point with 4 draggable tiles
- `todo` → `#todoView` — daily to-do list (keyed by `state.currentDate`)
- `notes` → `#notesView` — sticky-note canvas
- `pages` → `#pagesView` — multi-page rich text editor
- `task` → `#taskView` — Kanban board (global, not date-scoped)

**localStorage key conventions:**
- Daily todos: `YYYY-MM-DD` (via `dateKey()`)
- Post-it notes: `dnotes_YYYY-MM-DD`
- Pages: checked in `js/pages.js` (`loadPages`)
- Kanban: `kanban_board`, `kanban_cols`, `kanban_tags`, `kanban_assignees`
- Dashboard tile order: `tiles_order`

## Key Patterns

- **Render functions are idempotent** — each view has a `render*()` function that rebuilds its DOM from scratch from localStorage. Call them freely.
- **No events bubble between files** — views communicate only through `state.currentDate` and the `navigateTo()` / `renderAll()` globals in `app.js`.
- **`uid()`** generates IDs for all entities (todos, notes, tasks, pages).
- **Italian locale** throughout — day/month names in `utils.js`, UI strings embedded in each file.
