/**
 * Artist name normalization utilities.
 *
 * Used by both the scraper (to clean scraped names) and
 * the web app (to match user artists against shows).
 */

/**
 * Normalizes an artist name for comparison.
 * - Lowercases
 * - Trims whitespace
 * - Removes common prefixes/suffixes
 * - Collapses multiple spaces
 *
 * @param {string} name - Raw artist name
 * @returns {string} Normalized name
 */
function normalizeArtistName(name) {
  if (typeof name !== 'string') return '';

  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .replace(/^the\s+/i, '')        // Remove leading "The "
    .replace(/\s+&\s+/g, ' and ')   // Normalize "&" to "and"
    .replace(/['']/g, "'")          // Normalize apostrophes
    .trim();
}

/**
 * Checks if two artist names match after normalization.
 * @param {string} a - First artist name
 * @param {string} b - Second artist name
 * @returns {boolean}
 */
function artistNamesMatch(a, b) {
  return normalizeArtistName(a) === normalizeArtistName(b);
}

/**
 * Creates a Set of normalized artist names for efficient lookup.
 * @param {Array<{name: string}>} artists - Array of artist objects
 * @returns {Set<string>} Set of normalized names
 */
function createArtistNameSet(artists) {
  const set = new Set();

  for (const artist of artists) {
    if (artist && artist.name) {
      set.add(normalizeArtistName(artist.name));
    }
  }

  return set;
}

/**
 * Finds shows that match any artist in the user's set.
 * @param {Set<string>} userArtistNames - Normalized artist name set
 * @param {Array} shows - Array of show objects
 * @returns {Array} Matching shows, sorted by date
 */
function findMatchingShows(userArtistNames, shows) {
  const matches = shows.filter(show => {
    if (!show || !Array.isArray(show.artists)) {
      return false;
    }

    return show.artists.some(artist => {
      const normalized = normalizeArtistName(artist);
      return userArtistNames.has(normalized);
    });
  });

  // Sort by date (ascending)
  matches.sort((a, b) => {
    try {
      return new Date(a.date) - new Date(b.date);
    } catch {
      return 0;
    }
  });

  return matches;
}

module.exports = {
  normalizeArtistName,
  artistNamesMatch,
  createArtistNameSet,
  findMatchingShows,
};
