/**
 * Weekly Calendar View Component
 *
 * Renders a 7-column grid (Monday → Sunday) for displaying shows.
 * Desktop-only, layout-focused skeleton for future styling.
 *
 * COMPONENT HIERARCHY:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ .calendar                                                       │
 * │ ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
 * │ │ .calendar-day (×7, one per day Mon-Sun)                              │
 * │ │ ┌─────────────────────────────────────────────────────────────────┐ │
 * │ │ │ .calendar-day__header                                           │ │
 * │ │ │   .calendar-day__name  ("Mon")                                  │ │
 * │ │ │   .calendar-day__date  ("10")                                   │ │
 * │ │ └─────────────────────────────────────────────────────────────────┘ │
 * │ │ ┌─────────────────────────────────────────────────────────────────┐ │
 * │ │ │ .calendar-day__shows                                            │ │
 * │ │ │   .calendar-show (×N)  OR  .calendar-day__empty                 │ │
 * │ │ │     .calendar-show__artist                                      │ │
 * │ │ │     .calendar-show__venue                                       │ │
 * │ │ │     .calendar-show__time                                        │ │
 * │ │ └─────────────────────────────────────────────────────────────────┘ │
 * │ └─────────────────────────────────────────────────────────────────────┘
 * └─────────────────────────────────────────────────────────────────┘
 *
 * DATA CONTRACT:
 * Expects WeekSchedule from weeklyShows.js:
 * {
 *   weekStartDate: Date,
 *   weekEndDate: Date,
 *   days: [
 *     { label: 'Mon', date: '2026-02-09', shows: [...] },
 *     ...
 *   ]
 * }
 *
 * VISUAL SEMANTICS:
 * - [data-is-today="true"]  → Column representing today
 * - [data-is-past="true"]   → Columns for days before today
 * - These are data attributes for CSS hooks, not inline styles
 */

const WeeklyCalendar = (function () {
  'use strict';

  /**
   * Gets today's date as ISO string (YYYY-MM-DD) for comparison.
   * Extracted for testability.
   */
  function getTodayISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Escapes HTML to prevent XSS when rendering user-controlled data.
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  /**
   * Extracts numeric day from ISO date string.
   * "2026-02-09" → "9"
   * @param {string} isoDate
   * @returns {string}
   */
  function getDayNumber(isoDate) {
    const day = parseInt(isoDate.split('-')[2], 10);
    return String(day);
  }

  /**
   * Truncates text to maxLength characters, adding ellipsis if needed.
   * @param {string} text
   * @param {number} maxLength - Truncate if longer than this
   * @param {number} truncateTo - Length to truncate to (before ellipsis)
   * @returns {string}
   */
  function truncateText(text, maxLength, truncateTo) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.slice(0, truncateTo) + '…';
  }

  /**
   * Renders a single show block.
   *
   * @param {Object} show - Show object with artists, venue, time
   * @returns {string} HTML string
   */
  function renderShow(show) {
    // Display first artist as primary, could extend to show all
    const fullArtistName = Array.isArray(show.artists)
      ? show.artists.join(', ')
      : 'Unknown Artist';

    // Truncate long artist names: if > 30 chars, show first 25 + ellipsis
    const artistDisplay = truncateText(fullArtistName, 30, 25);
    const isTruncated = artistDisplay !== fullArtistName;

    // Add title attribute for tooltip if truncated
    const titleAttr = isTruncated ? `title="${escapeHtml(fullArtistName)}"` : '';

    return `
      <div class="calendar-show">
        <div class="calendar-show__artist" ${titleAttr}>${escapeHtml(artistDisplay)}</div>
        <div class="calendar-show__venue">${escapeHtml(show.venue)}</div>
        <div class="calendar-show__time">${escapeHtml(show.time)}</div>
      </div>
    `;
  }

  /**
   * Renders the shows area for a day column.
   * Shows placeholder if no shows exist.
   *
   * @param {Array} shows - Array of show objects
   * @returns {string} HTML string
   */
  function renderShowsArea(shows) {
    if (!shows || shows.length === 0) {
      return `
        <div class="calendar-day__shows">
          <div class="calendar-day__empty">No shows</div>
        </div>
      `;
    }

    const showsHtml = shows.map(renderShow).join('');

    return `
      <div class="calendar-day__shows">
        ${showsHtml}
      </div>
    `;
  }

  /**
   * Renders a single day column.
   *
   * @param {Object} day - Day object { label, date, shows }
   * @param {string} todayISO - Today's ISO date for comparison
   * @returns {string} HTML string
   */
  function renderDayColumn(day, todayISO) {
    const isToday = day.date === todayISO;
    const isPast = day.date < todayISO;

    // Data attributes for CSS styling hooks
    const dataAttrs = [
      `data-date="${escapeHtml(day.date)}"`,
      `data-is-today="${isToday}"`,
      `data-is-past="${isPast}"`,
    ].join(' ');

    return `
      <div class="calendar-day" ${dataAttrs}>
        <div class="calendar-day__header">
          <span class="calendar-day__name">${escapeHtml(day.label)}</span>
          <span class="calendar-day__date">${getDayNumber(day.date)}</span>
        </div>
        ${renderShowsArea(day.shows)}
      </div>
    `;
  }

  /**
   * Renders the complete weekly calendar grid.
   *
   * @param {Object} weekData - WeekSchedule object from weeklyShows.js
   * @param {HTMLElement} container - DOM element to render into
   */
  function render(weekData, container) {
    if (!weekData || !weekData.days || !container) {
      console.error('WeeklyCalendar.render: Invalid weekData or container');
      return;
    }

    const todayISO = getTodayISO();

    // Build the 7-column grid
    const columnsHtml = weekData.days
      .map(day => renderDayColumn(day, todayISO))
      .join('');

    // Wrap in calendar container with week metadata
    const calendarHtml = `
      <div class="calendar"
           data-week-start="${escapeHtml(weekData.weekStartDate.toISOString())}"
           data-week-end="${escapeHtml(weekData.weekEndDate.toISOString())}">
        ${columnsHtml}
      </div>
    `;

    container.innerHTML = calendarHtml;
  }

  /**
   * Clears the calendar container.
   *
   * @param {HTMLElement} container
   */
  function clear(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  // Public API
  return {
    render,
    clear,
    // Expose for testing
    _internal: {
      getTodayISO,
      getDayNumber,
      renderShow,
      renderDayColumn,
    },
  };
})();

// Export for module systems if available, otherwise global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeeklyCalendar;
}
