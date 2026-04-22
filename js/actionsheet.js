'use strict';

class ActionSheet {
  constructor() {
    this._overlay = null;
    this._el      = null;
    this._build();
  }

  _build() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'as-overlay';
    this._overlay.addEventListener('click', () => this.close());

    this._el = document.createElement('div');
    this._el.className = 'action-sheet';
    this._el.addEventListener('click', e => e.stopPropagation());

    document.body.appendChild(this._overlay);
    document.body.appendChild(this._el);
  }

  // actions: [{ key, svgIcon, label, danger, handler }]
  open(title, actions) {
    const actionsHtml = actions.map(a => `
      <button class="as-btn${a.danger ? ' as-btn--danger' : ''}" data-key="${a.key}">
        <span class="as-btn-icon">${a.svgIcon}</span>
        <span class="as-btn-label">${a.label}</span>
      </button>
    `).join('<div class="as-divider"></div>');

    this._el.innerHTML = `
      <div class="as-title">${escHtml(title)}</div>
      <div class="as-actions">${actionsHtml}</div>
      <div class="as-divider as-divider--gap"></div>
      <button class="as-cancel">Annulla</button>
    `;

    actions.forEach(a => {
      this._el.querySelector(`[data-key="${a.key}"]`).addEventListener('click', () => {
        this.close();
        a.handler();
      });
    });

    this._el.querySelector('.as-cancel').addEventListener('click', () => this.close());

    this._overlay.classList.add('open');
    this._el.classList.add('open');
  }

  close() {
    this._overlay.classList.remove('open');
    this._el.classList.remove('open');
  }
}

const actionSheet = new ActionSheet();
