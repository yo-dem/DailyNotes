'use strict';

const state = {
  currentDate: (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })()
};

function getTodos() {
  return loadTodos(state.currentDate);
}

function setTodos(todos) {
  saveTodos(state.currentDate, todos);
}
