'use strict';

class TimePicker {
  constructor() {
    this._onSelect      = null;
    this._selectedHour  = null;
    this._selectedMin   = null;
    this._overlay       = null;
    this._el            = null;
    this._build();
  }

  _build() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'tp-overlay';
    this._overlay.addEventListener('click', () => this.close());

    this._el = document.createElement('div');
    this._el.className = 'time-picker';
    this._el.addEventListener('click', e => e.stopPropagation());

    document.body.appendChild(this._overlay);
    document.body.appendChild(this._el);
  }

  open(currentTime, onSelect) {
    this._onSelect = onSelect;
    if (currentTime) {
      const [h, m]       = currentTime.split(':').map(Number);
      this._selectedHour = h;
      this._selectedMin  = m;
    } else {
      const now = new Date();
      this._selectedHour = now.getHours();
      this._selectedMin  = Math.round(now.getMinutes() / 5) * 5 % 60;
    }
    this._render();
    this._overlay.classList.add('open');
    this._el.classList.add('open');
    setTimeout(() => this._scrollToSelected(), 80);
  }

  close() {
    this._overlay.classList.remove('open');
    this._el.classList.remove('open');
  }

  _displayTime() {
    const h = this._selectedHour !== null ? String(this._selectedHour).padStart(2, '0') : '--';
    const m = this._selectedMin  !== null ? String(this._selectedMin).padStart(2, '0')  : '--';
    return `${h}:${m}`;
  }

  _render() {
    let hoursHtml = '';
    for (let h = 0; h < 24; h++) {
      const sel = this._selectedHour === h;
      hoursHtml += `<div class="tp-item${sel ? ' selected' : ''}" data-h="${h}">${String(h).padStart(2, '0')}</div>`;
    }

    let minsHtml = '';
    for (let m = 0; m < 60; m += 5) {
      const sel = this._selectedMin === m;
      minsHtml += `<div class="tp-item${sel ? ' selected' : ''}" data-m="${m}">${String(m).padStart(2, '0')}</div>`;
    }

    this._el.innerHTML = `
      <div class="tp-header">
        <span class="tp-title">Imposta orario</span>
        <div class="tp-display">${this._displayTime()}</div>
      </div>
      <div class="tp-body">
        <div class="tp-col">
          <div class="tp-col-label">Ore</div>
          <div class="tp-scroll" id="tpHours">${hoursHtml}</div>
        </div>
        <div class="tp-colon">:</div>
        <div class="tp-col">
          <div class="tp-col-label">Min</div>
          <div class="tp-scroll" id="tpMins">${minsHtml}</div>
        </div>
      </div>
      <div class="tp-actions">
        <button class="tp-clear">Rimuovi</button>
        <button class="tp-confirm">Conferma</button>
      </div>
    `;

    this._el.querySelectorAll('[data-h]').forEach(item => {
      item.addEventListener('click', () => {
        this._selectedHour = parseInt(item.dataset.h, 10);
        if (this._selectedMin === null) this._selectedMin = 0;
        this._updateDisplay();
        this._el.querySelectorAll('[data-h]').forEach(i => i.classList.toggle('selected', i === item));
        this._updateMins();
      });
    });

    this._el.querySelectorAll('[data-m]').forEach(item => {
      item.addEventListener('click', () => {
        this._selectedMin = parseInt(item.dataset.m, 10);
        if (this._selectedHour === null) this._selectedHour = 9;
        this._updateDisplay();
        this._el.querySelectorAll('[data-m]').forEach(i => i.classList.toggle('selected', i === item));
        this._updateHours();
      });
    });

    this._el.querySelector('.tp-clear').addEventListener('click', () => {
      if (this._onSelect) this._onSelect('');
      this.close();
    });

    this._el.querySelector('.tp-confirm').addEventListener('click', () => {
      if (this._selectedHour !== null && this._selectedMin !== null) {
        const t = `${String(this._selectedHour).padStart(2,'0')}:${String(this._selectedMin).padStart(2,'0')}`;
        if (this._onSelect) this._onSelect(t);
      }
      this.close();
    });
  }

  _updateDisplay() {
    const d = this._el.querySelector('.tp-display');
    if (d) d.textContent = this._displayTime();
  }

  _updateHours() {
    this._el.querySelectorAll('[data-h]').forEach(i => {
      i.classList.toggle('selected', parseInt(i.dataset.h, 10) === this._selectedHour);
    });
  }

  _updateMins() {
    this._el.querySelectorAll('[data-m]').forEach(i => {
      i.classList.toggle('selected', parseInt(i.dataset.m, 10) === this._selectedMin);
    });
  }

  _scrollToSelected() {
    const hScroll = this._el.querySelector('#tpHours');
    const mScroll = this._el.querySelector('#tpMins');

    if (hScroll && this._selectedHour !== null) {
      const item = hScroll.querySelector(`[data-h="${this._selectedHour}"]`);
      if (item) item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (mScroll && this._selectedMin !== null) {
      const item = mScroll.querySelector(`[data-m="${this._selectedMin}"]`);
      if (item) item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
}

const timePicker = new TimePicker();
