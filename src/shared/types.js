/**
 * Shared type definitions and schema validation.
 *
 * This is the single source of truth for data shapes
 * that flow between the scraper and web app.
 */

/**
 * @typedef {Object} Show
 * @property {string[]} artists - List of performing artists
 * @property {string} venue - Venue name
 * @property {string} date - Show date (formatted string)
 * @property {string} time - Show time (formatted string)
 * @property {string} [url] - Optional link to show details
 */

/**
 * @typedef {Object} Artist
 * @property {string} name - Artist name
 * @property {string} [url] - Optional Spotify/external URL
 * @property {string} [image] - Optional image URL
 */

/**
 * Validates a show object has required fields.
 * @param {any} show - Object to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateShow(show) {
  const errors = [];

  if (!show || typeof show !== 'object') {
    return { valid: false, errors: ['Show must be an object'] };
  }

  if (!Array.isArray(show.artists)) {
    errors.push('artists must be an array');
  } else if (show.artists.length === 0) {
    errors.push('artists cannot be empty');
  } else if (!show.artists.every(a => typeof a === 'string')) {
    errors.push('all artists must be strings');
  }

  if (typeof show.venue !== 'string' || !show.venue.trim()) {
    errors.push('venue must be a non-empty string');
  }

  if (typeof show.date !== 'string' || !show.date.trim()) {
    errors.push('date must be a non-empty string');
  }

  if (typeof show.time !== 'string' || !show.time.trim()) {
    errors.push('time must be a non-empty string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an array of shows, filtering out invalid ones.
 * @param {any[]} shows - Array to validate
 * @param {Object} [options]
 * @param {boolean} [options.strict=false] - Throw on any invalid show
 * @returns {Show[]} Valid shows
 */
function validateShows(shows, { strict = false } = {}) {
  if (!Array.isArray(shows)) {
    throw new Error('Shows must be an array');
  }

  const validShows = [];

  for (let i = 0; i < shows.length; i++) {
    const { valid, errors } = validateShow(shows[i]);

    if (valid) {
      validShows.push(shows[i]);
    } else if (strict) {
      throw new Error(`Invalid show at index ${i}: ${errors.join(', ')}`);
    }
    // In non-strict mode, silently skip invalid shows
  }

  return validShows;
}

module.exports = {
  validateShow,
  validateShows,
};
