/**
 * Tests for type validation.
 *
 * Run with: npm test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { validateShow, validateShows } = require('../src/shared/types');

describe('validateShow', () => {
  it('should pass valid show', () => {
    const show = {
      artists: ['Artist 1', 'Artist 2'],
      venue: 'Brooklyn Steel',
      date: '2025-06-15',
      time: '8:00 PM',
    };

    const result = validateShow(show);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should fail if artists is not an array', () => {
    const show = {
      artists: 'Artist',
      venue: 'Venue',
      date: '2025-01-01',
      time: '8pm',
    };

    const result = validateShow(show);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('artists')));
  });

  it('should fail if artists is empty', () => {
    const show = {
      artists: [],
      venue: 'Venue',
      date: '2025-01-01',
      time: '8pm',
    };

    const result = validateShow(show);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('empty')));
  });

  it('should fail if venue is missing', () => {
    const show = {
      artists: ['Artist'],
      date: '2025-01-01',
      time: '8pm',
    };

    const result = validateShow(show);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('venue')));
  });

  it('should fail for null input', () => {
    const result = validateShow(null);
    assert.strictEqual(result.valid, false);
  });
});

describe('validateShows', () => {
  it('should filter out invalid shows in non-strict mode', () => {
    const shows = [
      { artists: ['Valid'], venue: 'V', date: 'd', time: 't' },
      { artists: [], venue: 'V', date: 'd', time: 't' }, // invalid
      null, // invalid
      { artists: ['Also Valid'], venue: 'V2', date: 'd2', time: 't2' },
    ];

    const result = validateShows(shows);
    assert.strictEqual(result.length, 2);
  });

  it('should throw in strict mode on invalid show', () => {
    const shows = [
      { artists: ['Valid'], venue: 'V', date: 'd', time: 't' },
      { artists: [], venue: 'V', date: 'd', time: 't' }, // invalid
    ];

    assert.throws(() => validateShows(shows, { strict: true }), /Invalid show/);
  });

  it('should throw if input is not an array', () => {
    assert.throws(() => validateShows('not an array'), /must be an array/);
  });
});
