/**
 * Weekly Shows Organizer (Browser Version)
 *
 * Transforms a flat array of shows into a week-based structure.
 * Mirror of src/utils/weeklyShows.js for frontend use.
 */

const WeeklyShows = (function () {
  'use strict';

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /**
   * Parses a US locale date string "M/D/YYYY" into a Date object.
   */
  function parseShowDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;

    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  /**
   * Parses time string "HH:MM AM/PM" into minutes since midnight.
   */
  function parseShowTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;

    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'AM' && hours === 12) {
      hours = 0;
    } else if (period === 'PM' && hours !== 12) {
      hours += 12;
    }

    return hours * 60 + minutes;
  }

  /**
   * Gets the Monday of the week containing the given date.
   */
  function getWeekStart(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    d.setDate(d.getDate() - daysFromMonday);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Gets the Sunday of the week containing the given date.
   */
  function getWeekEnd(date) {
    const monday = getWeekStart(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  }

  /**
   * Formats a Date as "YYYY-MM-DD".
   */
  function toISODateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Organizes shows into a weekly schedule structure.
   */
  function organizeByWeek(shows, referenceDate) {
    const refDate = new Date(referenceDate || new Date());
    const weekStart = getWeekStart(refDate);
    const weekEnd = getWeekEnd(refDate);

    const days = DAY_LABELS.map((label, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);

      return {
        label,
        date: toISODateString(dayDate),
        shows: [],
      };
    });

    const daysByDate = new Map(days.map(day => [day.date, day]));

    for (const show of shows) {
      const showDate = parseShowDate(show.date);
      if (!showDate) continue;

      const isoDate = toISODateString(showDate);
      const day = daysByDate.get(isoDate);

      if (day) {
        day.shows.push({ ...show });
      }
    }

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
   * Gets shows for current week.
   */
  function getCurrentWeek(shows) {
    return organizeByWeek(shows, new Date());
  }

  /**
   * Gets shows for a week offset from current.
   */
  function getWeekByOffset(shows, weekOffset) {
    const refDate = new Date();
    refDate.setDate(refDate.getDate() + weekOffset * 7);
    return organizeByWeek(shows, refDate);
  }

  return {
    organizeByWeek,
    getCurrentWeek,
    getWeekByOffset,
    parseShowDate,
    toISODateString,
  };
})();
