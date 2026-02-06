const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  organizeShowsByWeek,
  parseShowDate,
  parseShowTime,
  getWeekStart,
  getWeekEnd,
  toISODateString,
} = require('../src/utils/weeklyShows');

describe('parseShowDate', () => {
  it('should parse valid US locale date', () => {
    const date = parseShowDate('2/10/2026');
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 1); // February = 1
    assert.strictEqual(date.getDate(), 10);
  });

  it('should return null for invalid date string', () => {
    assert.strictEqual(parseShowDate('invalid'), null);
    assert.strictEqual(parseShowDate(''), null);
    assert.strictEqual(parseShowDate(null), null);
  });

  it('should return null for invalid date values', () => {
    assert.strictEqual(parseShowDate('2/30/2026'), null); // Feb 30 doesn't exist
  });
});

describe('parseShowTime', () => {
  it('should parse AM times', () => {
    assert.strictEqual(parseShowTime('09:30 AM'), 9 * 60 + 30);
    assert.strictEqual(parseShowTime('11:00 AM'), 11 * 60);
  });

  it('should parse PM times', () => {
    assert.strictEqual(parseShowTime('07:00 PM'), 19 * 60);
    assert.strictEqual(parseShowTime('09:30 PM'), 21 * 60 + 30);
  });

  it('should handle 12:00 AM (midnight)', () => {
    assert.strictEqual(parseShowTime('12:00 AM'), 0);
  });

  it('should handle 12:00 PM (noon)', () => {
    assert.strictEqual(parseShowTime('12:00 PM'), 12 * 60);
  });

  it('should return 0 for invalid time', () => {
    assert.strictEqual(parseShowTime('invalid'), 0);
    assert.strictEqual(parseShowTime(''), 0);
  });
});

describe('getWeekStart', () => {
  it('should return Monday for a Wednesday', () => {
    const wednesday = new Date('2026-02-11T12:00:00');
    const monday = getWeekStart(wednesday);
    assert.strictEqual(monday.getDay(), 1); // Monday
    assert.strictEqual(toISODateString(monday), '2026-02-09');
  });

  it('should return same day for a Monday', () => {
    const monday = new Date('2026-02-09T12:00:00');
    const result = getWeekStart(monday);
    assert.strictEqual(toISODateString(result), '2026-02-09');
  });

  it('should return previous Monday for a Sunday', () => {
    const sunday = new Date('2026-02-15T12:00:00');
    const monday = getWeekStart(sunday);
    assert.strictEqual(toISODateString(monday), '2026-02-09');
  });

  it('should set time to midnight', () => {
    const date = new Date('2026-02-11T15:30:00');
    const monday = getWeekStart(date);
    assert.strictEqual(monday.getHours(), 0);
    assert.strictEqual(monday.getMinutes(), 0);
    assert.strictEqual(monday.getSeconds(), 0);
  });
});

describe('getWeekEnd', () => {
  it('should return Sunday for a Wednesday', () => {
    const wednesday = new Date('2026-02-11T12:00:00');
    const sunday = getWeekEnd(wednesday);
    assert.strictEqual(sunday.getDay(), 0); // Sunday
    assert.strictEqual(toISODateString(sunday), '2026-02-15');
  });

  it('should set time to 23:59:59.999', () => {
    const date = new Date('2026-02-11T15:30:00');
    const sunday = getWeekEnd(date);
    assert.strictEqual(sunday.getHours(), 23);
    assert.strictEqual(sunday.getMinutes(), 59);
    assert.strictEqual(sunday.getSeconds(), 59);
    assert.strictEqual(sunday.getMilliseconds(), 999);
  });
});

describe('organizeShowsByWeek', () => {
  const sampleShows = [
    { artists: ['Band A'], venue: 'Venue 1', date: '2/10/2026', time: '08:00 PM' },
    { artists: ['Band B'], venue: 'Venue 2', date: '2/10/2026', time: '07:00 PM' },
    { artists: ['Band C'], venue: 'Venue 3', date: '2/12/2026', time: '12:00 AM' },
    { artists: ['Band D'], venue: 'Venue 4', date: '2/15/2026', time: '09:00 PM' },
  ];

  const refDate = new Date('2026-02-11T12:00:00'); // Wednesday

  it('should return correct week boundaries', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    assert.strictEqual(toISODateString(result.weekStartDate), '2026-02-09');
    assert.strictEqual(toISODateString(result.weekEndDate), '2026-02-15');
  });

  it('should always return 7 days', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    assert.strictEqual(result.days.length, 7);
  });

  it('should have days in Mon-Sun order', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    const labels = result.days.map(d => d.label);
    assert.deepStrictEqual(labels, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('should have correct ISO dates for each day', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    const dates = result.days.map(d => d.date);
    assert.deepStrictEqual(dates, [
      '2026-02-09', '2026-02-10', '2026-02-11', '2026-02-12',
      '2026-02-13', '2026-02-14', '2026-02-15',
    ]);
  });

  it('should assign shows to correct days', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    assert.strictEqual(result.days[1].shows.length, 2); // Tuesday: Band A & B
    assert.strictEqual(result.days[3].shows.length, 1); // Thursday: Band C
    assert.strictEqual(result.days[6].shows.length, 1); // Sunday: Band D
  });

  it('should sort shows by time within a day', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    const tuesday = result.days[1];
    assert.strictEqual(tuesday.shows[0].time, '07:00 PM'); // Band B first
    assert.strictEqual(tuesday.shows[1].time, '08:00 PM'); // Band A second
  });

  it('should handle midnight shows correctly', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    const thursday = result.days[3];
    assert.strictEqual(thursday.shows[0].time, '12:00 AM');
    assert.strictEqual(thursday.shows[0].artists[0], 'Band C');
  });

  it('should have empty arrays for days with no shows', () => {
    const result = organizeShowsByWeek(sampleShows, refDate);
    assert.strictEqual(result.days[0].shows.length, 0); // Monday
    assert.strictEqual(result.days[2].shows.length, 0); // Wednesday
    assert.strictEqual(result.days[4].shows.length, 0); // Friday
    assert.strictEqual(result.days[5].shows.length, 0); // Saturday
  });

  it('should handle week with no shows', () => {
    const result = organizeShowsByWeek([], refDate);
    assert.strictEqual(result.days.length, 7);
    result.days.forEach(day => {
      assert.strictEqual(day.shows.length, 0);
    });
  });

  it('should not include shows from other weeks', () => {
    const showsWithOutsideWeek = [
      ...sampleShows,
      { artists: ['Outside'], venue: 'V', date: '2/20/2026', time: '08:00 PM' }, // Next week
      { artists: ['Before'], venue: 'V', date: '2/1/2026', time: '08:00 PM' },   // Previous week
    ];
    const result = organizeShowsByWeek(showsWithOutsideWeek, refDate);
    const totalShows = result.days.reduce((sum, d) => sum + d.shows.length, 0);
    assert.strictEqual(totalShows, 4); // Only original 4 shows
  });

  it('should not mutate input shows array', () => {
    const shows = [{ artists: ['Test'], venue: 'V', date: '2/10/2026', time: '08:00 PM' }];
    const originalLength = shows.length;
    const originalShow = { ...shows[0] };

    organizeShowsByWeek(shows, refDate);

    assert.strictEqual(shows.length, originalLength);
    assert.deepStrictEqual(shows[0], originalShow);
  });

  it('should not mutate input show objects', () => {
    const shows = [{ artists: ['Test'], venue: 'V', date: '2/10/2026', time: '08:00 PM' }];
    const result = organizeShowsByWeek(shows, refDate);

    // Modify the result
    result.days[1].shows[0].venue = 'Modified';

    // Original should be unchanged
    assert.strictEqual(shows[0].venue, 'V');
  });

  it('should be deterministic with same inputs', () => {
    const result1 = organizeShowsByWeek(sampleShows, refDate);
    const result2 = organizeShowsByWeek(sampleShows, refDate);

    assert.deepStrictEqual(
      result1.days.map(d => ({ label: d.label, date: d.date, count: d.shows.length })),
      result2.days.map(d => ({ label: d.label, date: d.date, count: d.shows.length }))
    );
  });

  it('should handle reference date at start of week (Monday)', () => {
    const monday = new Date('2026-02-09T00:00:00');
    const result = organizeShowsByWeek(sampleShows, monday);
    assert.strictEqual(toISODateString(result.weekStartDate), '2026-02-09');
    assert.strictEqual(toISODateString(result.weekEndDate), '2026-02-15');
  });

  it('should handle reference date at end of week (Sunday)', () => {
    const sunday = new Date('2026-02-15T23:59:59');
    const result = organizeShowsByWeek(sampleShows, sunday);
    assert.strictEqual(toISODateString(result.weekStartDate), '2026-02-09');
    assert.strictEqual(toISODateString(result.weekEndDate), '2026-02-15');
  });

  it('should skip shows with invalid dates', () => {
    const showsWithInvalid = [
      { artists: ['Valid'], venue: 'V', date: '2/10/2026', time: '08:00 PM' },
      { artists: ['Invalid'], venue: 'V', date: 'bad-date', time: '08:00 PM' },
    ];
    const result = organizeShowsByWeek(showsWithInvalid, refDate);
    const totalShows = result.days.reduce((sum, d) => sum + d.shows.length, 0);
    assert.strictEqual(totalShows, 1);
  });
});
