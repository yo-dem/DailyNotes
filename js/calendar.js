'use strict';

class CalendarPicker {
  constructor() {
    this._onSelect       = null;
    this._viewYear       = 0;
    this._viewMonth      = 0;
    this._selected       = null;
    this._overlay        = null;
    this._el             = null;
    this._yearMode       = false;
    this._tooltip        = null;
    this._lpTimer        = null;  // long-press timer
    this._lpFired        = false; // long press triggered
    this._build();
  }

  _build() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'cal-overlay';
    this._overlay.addEventListener('click', () => this.close());

    this._el = document.createElement('div');
    this._el.className = 'calendar-picker';
    this._el.addEventListener('click', e => e.stopPropagation());

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'cal-tooltip';
    this._tooltip.style.display = 'none';

    document.body.appendChild(this._overlay);
    document.body.appendChild(this._el);
    document.body.appendChild(this._tooltip);
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
    this._hideTooltip();
  }

  _buildSummary(key) {
    const rows = [];
    try {
      const todos = JSON.parse(localStorage.getItem(key)) || [];
      if (todos.length) {
        const done = todos.filter(t => t.done).length;
        rows.push(`<span class="ctt-row"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><polyline points="5 8 7 10 11 6"/></svg>${todos.length} todo${done ? ` <em>(${done} fatti)</em>` : ''}</span>`);
      }
    } catch {}
    try {
      const notes = JSON.parse(localStorage.getItem('dnotes_' + key)) || [];
      if (notes.length) {
        rows.push(`<span class="ctt-row"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="10" height="12" rx="1.5"/><line x1="5" y1="6" x2="9" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/><polyline points="9 2 9 6 13 6 13 14 2 14"/></svg>${notes.length} post-it</span>`);
      }
    } catch {}
    return rows.join('');
  }

  _showTooltip(el, key) {
    const html = this._buildSummary(key);
    if (!html) return;
    this._tooltip.innerHTML = html;
    this._tooltip.style.display = 'block';

    const rect = el.getBoundingClientRect();
    const tw   = this._tooltip.offsetWidth;
    const th   = this._tooltip.offsetHeight;

    let top  = rect.top - th - 10;
    let left = rect.left + rect.width / 2 - tw / 2;
    if (top < 8) top = rect.bottom + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));

    this._tooltip.style.top  = top + 'px';
    this._tooltip.style.left = left + 'px';
    this._tooltip.classList.add('visible');
  }

  _hideTooltip() {
    this._tooltip.classList.remove('visible');
    this._tooltip.style.display = 'none';
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
    const dowLabels = i18n.t('daysShortMon')
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

      const hasTodos = (() => { try { const r = localStorage.getItem(key); return r && JSON.parse(r).length > 0; } catch { return false; } })();
      const hasNotes = (() => { try { const r = localStorage.getItem('dnotes_' + key); return r && JSON.parse(r).length > 0; } catch { return false; } })();

      let cls = 'cal-day';
      if (isWeekend) cls += ' weekend';
      if (isToday)    cls += ' today';
      if (isSelected) cls += ' selected';
      if (hasTodos)   cls += ' has-todo';
      if (hasNotes)   cls += ' has-note';

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
        <span class="cal-month-year">${i18n.t('months')[m]} <button class="cal-year-btn" title="${i18n.t('selectYear')}">${y}</button></span>
        <button class="cal-nav" data-dir="1">&#8250;</button>
      </div>
      <div class="cal-grid">
        ${dowLabels}
        ${cells}
      </div>
      <div class="cal-separator"></div>
      <button class="cal-today-btn">${i18n.t('today')}</button>
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
        if (this._lpFired) { this._lpFired = false; return; }
        const [sy, sm, sd] = span.dataset.date.split('-').map(Number);
        const picked = new Date(sy, sm - 1, sd);
        if (this._onSelect) this._onSelect(picked);
        this.close();
      });
    });

    // Hover tooltip (desktop)
    this._el.querySelectorAll('.cal-day.has-todo, .cal-day.has-note').forEach(span => {
      const key = span.dataset.date;
      if (!key) return;

      span.addEventListener('mouseenter', () => this._showTooltip(span, key));
      span.addEventListener('mouseleave', () => this._hideTooltip());

      // Long-press tooltip (touch)
      span.addEventListener('touchstart', () => {
        this._lpTimer = setTimeout(() => {
          this._lpFired = true;
          this._showTooltip(span, key);
          const dismiss = () => {
            this._hideTooltip();
            document.removeEventListener('touchstart', dismiss, true);
          };
          document.addEventListener('touchstart', dismiss, { capture: true, once: true });
        }, 500);
      }, { passive: true });

      span.addEventListener('touchmove', () => {
        clearTimeout(this._lpTimer);
      }, { passive: true });

      span.addEventListener('touchend', e => {
        clearTimeout(this._lpTimer);
        if (this._lpFired) e.preventDefault(); // block synthetic click
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
      <button class="cal-today-btn">${i18n.t('today')}</button>
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
