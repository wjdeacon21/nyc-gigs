/**
 * Tests for artist-to-show matching logic.
 *
 * Run with: npm test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  normalizeArtistName,
  artistNamesMatch,
  createArtistNameSet,
  findMatchingShows,
} = require('../src/shared/normalize');

describe('normalizeArtistName', () => {
  it('should lowercase names', () => {
    assert.strictEqual(normalizeArtistName('RADIOHEAD'), 'radiohead');
  });

  it('should trim whitespace', () => {
    assert.strictEqual(normalizeArtistName('  Radiohead  '), 'radiohead');
  });

  it('should collapse multiple spaces', () => {
    assert.strictEqual(normalizeArtistName('The   Black   Keys'), 'black keys');
  });

  it('should remove leading "The"', () => {
    assert.strictEqual(normalizeArtistName('The National'), 'national');
    assert.strictEqual(normalizeArtistName('THE STROKES'), 'strokes');
  });

  it('should normalize ampersands to "and"', () => {
    assert.strictEqual(normalizeArtistName('Simon & Garfunkel'), 'simon and garfunkel');
  });

  it('should normalize apostrophes', () => {
    assert.strictEqual(normalizeArtistName("Guns N' Roses"), "guns n' roses");
  });

  it('should handle non-string input', () => {
    assert.strictEqual(normalizeArtistName(null), '');
    assert.strictEqual(normalizeArtistName(undefined), '');
    assert.strictEqual(normalizeArtistName(123), '');
  });
});

describe('artistNamesMatch', () => {
  it('should match identical names', () => {
    assert.strictEqual(artistNamesMatch('Radiohead', 'Radiohead'), true);
  });

  it('should match case-insensitively', () => {
    assert.strictEqual(artistNamesMatch('RADIOHEAD', 'radiohead'), true);
  });

  it('should match with/without "The"', () => {
    assert.strictEqual(artistNamesMatch('The National', 'National'), true);
  });

  it('should not match different artists', () => {
    assert.strictEqual(artistNamesMatch('Radiohead', 'Coldplay'), false);
  });
});

describe('findMatchingShows', () => {
  it('should return empty array when no artists match', () => {
    const userArtists = createArtistNameSet([{ name: 'Artist A' }]);
    const shows = [
      { artists: ['Artist C'], venue: 'Venue', date: '2025-01-01', time: '8pm' }
    ];

    const result = findMatchingShows(userArtists, shows);
    assert.strictEqual(result.length, 0);
  });

  it('should find matching shows', () => {
    const userArtists = createArtistNameSet([{ name: 'Radiohead' }]);
    const shows = [
      { artists: ['RADIOHEAD'], venue: 'MSG', date: '2025-06-01', time: '8pm' }
    ];

    const result = findMatchingShows(userArtists, shows);
    assert.strictEqual(result.length, 1);
  });

  it('should match shows with multiple artists', () => {
    const userArtists = createArtistNameSet([{ name: 'Opener Band' }]);
    const shows = [
      { artists: ['Headliner', 'Opener Band'], venue: 'Venue', date: '2025-04-01', time: '7pm' }
    ];

    const result = findMatchingShows(userArtists, shows);
    assert.strictEqual(result.length, 1);
  });

  it('should sort matches by date ascending', () => {
    const userArtists = createArtistNameSet([{ name: 'Artist' }]);
    const shows = [
      { artists: ['Artist'], venue: 'V1', date: '2025-12-01', time: '8pm' },
      { artists: ['Artist'], venue: 'V2', date: '2025-01-15', time: '8pm' },
      { artists: ['Artist'], venue: 'V3', date: '2025-06-01', time: '8pm' },
    ];

    const result = findMatchingShows(userArtists, shows);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].venue, 'V2'); // Jan
    assert.strictEqual(result[1].venue, 'V3'); // Jun
    assert.strictEqual(result[2].venue, 'V1'); // Dec
  });

  it('should handle malformed show data gracefully', () => {
    const userArtists = createArtistNameSet([{ name: 'Artist' }]);
    const shows = [
      null,
      { artists: null },
      { artists: ['Artist'], venue: 'Valid', date: '2025-01-01', time: '8pm' },
    ];

    const result = findMatchingShows(userArtists, shows);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].venue, 'Valid');
  });

  it('should match "The X" with "X"', () => {
    const userArtists = createArtistNameSet([{ name: 'The National' }]);
    const shows = [
      { artists: ['National'], venue: 'Brooklyn Steel', date: '2025-03-15', time: '7pm' }
    ];

    const result = findMatchingShows(userArtists, shows);
    assert.strictEqual(result.length, 1);
  });
});
