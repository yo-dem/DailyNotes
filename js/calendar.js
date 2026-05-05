'use strict';

class CalendarPicker {
  constructor() {
    this._onSelect = null;
    this._viewYear  = 0;
    this._viewMonth = 0;
    this._selected  = null;
    this._overlay   = null;
    this._el        = null;
    this._yearMode  = false;
    this._build();
  }

  _build() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'cal-overlay';
    this._overlay.addEventListener('click', () => this.close());

    this._el = document.createElement('div');
    this._el.className = 'calendar-picker';
    this._el.addEventListener('click', e => e.stopPropagation());

    document.body.appendChild(this._overlay);
    document.body.appendChild(this._el);
  }

  open(date, onSelect) {
    this._onSelect  = onSelect;
    this._selected  = new Date(date);
    this._viewYear  = date.getFullYear();
    this._viewMonth = date.getMonth();
    this._yearMode  = false;
    this._render();
    this._overlay.classList.add('open');
    this._el.classList.add('open');
  }

  close() {
    this._overlay.classList.remove('open');
    this._el.classList.remove('open');
  }

  _render() {
    if (this._yearMode) { this._renderYears(); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const y = this._viewYear;
    const m = this._viewMonth;

    const firstWeekday = new Date(y, m, 1).getDay(); // 0=Sun
    const daysInMonth  = new Date(y, m + 1, 0).getDate();

    // Monday-first offset
    let startOffset = firstWeekday - 1;
    if (startOffset < 0) startOffset = 6;

    // Days of week headers (Mon–Sun)
    const dowLabels = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do']
      .map(l => `<span class="cal-dow">${l}</span>`)
      .join('');

    // Empty leading cells
    let cells = '';
    for (let i = 0; i < startOffset; i++) {
      cells += `<span class="cal-day" style="pointer-events:none"></span>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(y, m, d);
      const key = dateKey(thisDate);
      const isToday    = thisDate.getTime() === today.getTime();
      const isSelected = this._selected && thisDate.getTime() === this._selected.getTime();
      const isWeekend  = thisDate.getDay() === 0 || thisDate.getDay() === 6;

      let cls = 'cal-day';
      if (isWeekend) cls += ' weekend';
      if (isToday)    cls += ' today';
      if (isSelected) cls += ' selected';

      cells += `<span class="${cls}" data-date="${key}">${d}</span>`;
    }

    // always fill 6 rows (42 cells) so the grid height never changes
    const trailing = 42 - (startOffset + daysInMonth);
    for (let i = 0; i < trailing; i++) {
      cells += `<span class="cal-day" style="pointer-events:none"></span>`;
    }

    this._el.innerHTML = `
      <div class="cal-header">
        <button class="cal-nav" data-dir="-1">&#8249;</button>
        <span class="cal-month-year">${MONTHS_IT[m]} <button class="cal-year-btn" title="Seleziona anno">${y}</button></span>
        <button class="cal-nav" data-dir="1">&#8250;</button>
      </div>
      <div class="cal-grid">
        ${dowLabels}
        ${cells}
      </div>
      <div class="cal-separator"></div>
      <button class="cal-today-btn">Oggi</button>
    `;

    this._el.querySelectorAll('.cal-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        this._viewMonth += parseInt(btn.dataset.dir, 10);
        if (this._viewMonth < 0)  { this._viewMonth = 11; this._viewYear--; }
        if (this._viewMonth > 11) { this._viewMonth = 0;  this._viewYear++; }
        this._render();
      });
    });

    this._el.querySelector('.cal-year-btn').addEventListener('click', () => {
      this._yearMode = true;
      this._render();
    });

    this._el.querySelectorAll('.cal-day[data-date]').forEach(span => {
      span.addEventListener('click', () => {
        const [sy, sm, sd] = span.dataset.date.split('-').map(Number);
        const picked = new Date(sy, sm - 1, sd);
        if (this._onSelect) this._onSelect(picked);
        this.close();
      });
    });

    this._el.querySelector('.cal-today-btn').addEventListener('click', () => {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      if (this._onSelect) this._onSelect(t);
      this.close();
    });
  }

  _renderYears() {
    const todayYear = new Date().getFullYear();
    const base = this._viewYear - 7;
    const years = Array.from({ length: 16 }, (_, i) => base + i);

    const yearItems = years.map(y => {
      let cls = 'cal-year-item';
      if (y === this._viewYear) cls += ' selected';
      else if (y === todayYear) cls += ' today';
      return `<button class="${cls}" data-year="${y}">${y}</button>`;
    }).join('');

    this._el.innerHTML = `
      <div class="cal-header">
        <button class="cal-nav" data-dir="-1">&#8249;</button>
        <span class="cal-month-year">${base} – ${base + 15}</span>
        <button class="cal-nav" data-dir="1">&#8250;</button>
      </div>
      <div class="cal-year-grid">
        ${yearItems}
      </div>
      <div class="cal-separator"></div>
      <button class="cal-today-btn">Oggi</button>
    `;

    this._el.querySelectorAll('.cal-nav').forEach(btn => {
      btn.addEventListener('click', () => {
        this._viewYear += parseInt(btn.dataset.dir, 10) * 16;
        this._renderYears();
      });
    });

    this._el.querySelectorAll('.cal-year-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this._viewYear = parseInt(btn.dataset.year, 10);
        this._yearMode = false;
        this._render();
      });
    });

    this._el.querySelector('.cal-today-btn').addEventListener('click', () => {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      if (this._onSelect) this._onSelect(t);
      this.close();
    });
  }
}

const calendarPicker = new CalendarPicker();
