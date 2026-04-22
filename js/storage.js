'use strict';

function loadTodos(d) {
  try {
    const raw = localStorage.getItem(dateKey(d));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTodos(d, todos) {
  localStorage.setItem(dateKey(d), JSON.stringify(todos));
}
