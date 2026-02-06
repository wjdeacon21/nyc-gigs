/**
 * Weekly Shows Organizer
 *
 * Transforms a flat array of shows into a week-based structure for calendar display.
 *
 * DATA SHAPE RATIONALE:
 * - `days` is an array (not object) to guarantee iteration order Mon→Sun
 * - Each day always exists with an empty array if no shows, preventing null checks downstream
 * - Shows are sorted by parsed start time within each day for chronological display
 * - ISO date strings (YYYY-MM-DD) are timezone-agnostic and sort lexicographically
 * - Week boundaries use Monday start (ISO 8601) which is standard for event calendars
 *
 * @typedef {Object} Show
 * @property {string[]} artists
 * @property {string} venue
 * @property {string} date - US locale format: "M/D/YYYY"
 * @property {string} time - US locale format: "HH:MM AM/PM"
 *
 * @typedef {Object} DaySchedule
 * @property {string} label - Short day name: "Mon", "Tue", etc.
 * @property {string} date - ISO date string: "YYYY-MM-DD"
 * @property {Show[]} shows - Shows for this day, sorted by start time
 *
 * @typedef {Object} WeekSchedule
 * @property {Date} weekStartDate - Monday at 00:00:00.000
 * @property {Date} weekEndDate - Sunday at 23:59:59.999
 * @property {DaySchedule[]} days - Array of 7 days, always Mon-Sun order
 */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Parses a US locale date string "M/D/YYYY" into a Date object at midnight local time.
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseShowDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

  // Month is 0-indexed in JS Date
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  // Validate the date didn't roll over (e.g., Feb 30 → Mar 2)
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Parses a US locale time string "HH:MM AM/PM" into minutes since midnight.
 * Returns minutes for sorting; does not need full Date precision.
 * @param {string} timeStr
 * @returns {number} Minutes since midnight (0-1439), or 0 if unparseable
 */
function parseShowTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  // Convert 12-hour to 24-hour
  if (period === 'AM' && hours === 12) {
    hours = 0; // 12:00 AM = midnight
  } else if (period === 'PM' && hours !== 12) {
    hours += 12; // 1-11 PM → 13-23
  }

  return hours * 60 + minutes;
}

/**
 * Gets the Monday of the week containing the given date.
 * @param {Date} date
 * @returns {Date} Monday at 00:00:00.000
 */
function getWeekStart(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  // Convert to Monday-based: Mon=0, Tue=1, ..., Sun=6
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Gets the Sunday of the week containing the given date.
 * @param {Date} date
 * @returns {Date} Sunday at 23:59:59.999
 */
function getWeekEnd(date) {
  const monday = getWeekStart(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Formats a Date as ISO date string "YYYY-MM-DD".
 * @param {Date} date
 * @returns {string}
 */
function toISODateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Organizes shows into a weekly schedule structure.
 *
 * @param {Show[]} shows - Array of show objects (not mutated)
 * @param {Date} [referenceDate=new Date()] - Any date within the target week
 * @returns {WeekSchedule}
 */
function organizeShowsByWeek(shows, referenceDate = new Date()) {
  // Ensure we don't mutate the reference date
  const refDate = new Date(referenceDate);

  const weekStart = getWeekStart(refDate);
  const weekEnd = getWeekEnd(refDate);

  // Build the 7-day structure with empty arrays
  const days = DAY_LABELS.map((label, index) => {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + index);

    return {
      label,
      date: toISODateString(dayDate),
      shows: [],
    };
  });

  // Create a map for O(1) day lookup by ISO date
  const daysByDate = new Map(days.map(day => [day.date, day]));

  // Assign shows to days
  for (const show of shows) {
    const showDate = parseShowDate(show.date);
    if (!showDate) continue;

    const isoDate = toISODateString(showDate);
    const day = daysByDate.get(isoDate);

    if (day) {
      // Clone show to avoid mutating input
      day.shows.push({ ...show });
    }
  }

  // Sort shows within each day by start time
  for (const day of days) {
    day.shows.sort((a, b) => parseShowTime(a.time) - parseShowTime(b.time));
  }

  return {
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    days,
  };
}

/**
 * Convenience function to get shows for the current week.
 * @param {Show[]} shows
 * @returns {WeekSchedule}
 */
function getCurrentWeekShows(shows) {
  return organizeShowsByWeek(shows, new Date());
}

/**
 * Gets shows for a specific week offset from current week.
 * @param {Show[]} shows
 * @param {number} weekOffset - 0 = current week, 1 = next week, -1 = last week
 * @returns {WeekSchedule}
 */
function getWeekShowsByOffset(shows, weekOffset) {
  const refDate = new Date();
  refDate.setDate(refDate.getDate() + weekOffset * 7);
  return organizeShowsByWeek(shows, refDate);
}

module.exports = {
  organizeShowsByWeek,
  getCurrentWeekShows,
  getWeekShowsByOffset,
  // Export helpers for testing
  parseShowDate,
  parseShowTime,
  getWeekStart,
  getWeekEnd,
  toISODateString,
};


/*
 * ============================================================================
 * EXAMPLE INPUT/OUTPUT
 * ============================================================================
 *
 * Input shows:
 * [
 *   { artists: ['Band A'], venue: 'Venue 1', date: '2/10/2026', time: '08:00 PM' },
 *   { artists: ['Band B'], venue: 'Venue 2', date: '2/10/2026', time: '07:00 PM' },
 *   { artists: ['Band C'], venue: 'Venue 3', date: '2/12/2026', time: '12:00 AM' },
 *   { artists: ['Band D'], venue: 'Venue 4', date: '2/15/2026', time: '09:00 PM' },
 * ]
 *
 * Reference date: new Date('2026-02-11') (a Wednesday)
 *
 * Output:
 * {
 *   weekStartDate: Date('2026-02-09T00:00:00.000'),  // Monday
 *   weekEndDate: Date('2026-02-15T23:59:59.999'),    // Sunday
 *   days: [
 *     { label: 'Mon', date: '2026-02-09', shows: [] },
 *     { label: 'Tue', date: '2026-02-10', shows: [
 *         { artists: ['Band B'], venue: 'Venue 2', date: '2/10/2026', time: '07:00 PM' },
 *         { artists: ['Band A'], venue: 'Venue 1', date: '2/10/2026', time: '08:00 PM' },
 *       ]
 *     },
 *     { label: 'Wed', date: '2026-02-11', shows: [] },
 *     { label: 'Thu', date: '2026-02-12', shows: [
 *         { artists: ['Band C'], venue: 'Venue 3', date: '2/12/2026', time: '12:00 AM' },
 *       ]
 *     },
 *     { label: 'Fri', date: '2026-02-13', shows: [] },
 *     { label: 'Sat', date: '2026-02-14', shows: [] },
 *     { label: 'Sun', date: '2026-02-15', shows: [
 *         { artists: ['Band D'], venue: 'Venue 4', date: '2/15/2026', time: '09:00 PM' },
 *       ]
 *     },
 *   ]
 * }
 *
 * Notes:
 * - Band B appears before Band A on Tuesday (7 PM < 8 PM)
 * - Band C at midnight is sorted first on Thursday (00:00 = 0 minutes)
 * - Empty days (Mon, Wed, Fri, Sat) still have entries with empty arrays
 * - Shows outside the week (if any existed) would be excluded
 */
