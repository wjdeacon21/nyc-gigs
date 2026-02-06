/**
 * HTML parsing logic for OhMyRockness.
 *
 * FRAGILITY WARNING:
 * This code depends on OhMyRockness's HTML structure.
 * When the site updates, selectors here will likely break.
 *
 * To debug:
 * 1. Run scraper with LOG_LEVEL=debug
 * 2. Check if selectors still match the live HTML
 * 3. Update selectors in config.js
 */

const { config } = require('./config');

/**
 * Extracts shows from a page using Puppeteer's page context.
 * This function runs IN THE BROWSER via page.$$eval().
 *
 * @param {string} showRowSelector - Selector for show rows
 * @param {string} artistLinksSelector - Selector for artist links
 * @param {string} dateTimeSelector - Selector for datetime element
 * @param {string} venueSelector - Selector for venue element
 * @returns {Function} Extraction function for page.$$eval
 */
function createShowExtractor(selectors) {
  // This function is serialized and run in the browser context
  // It cannot access Node.js variables directly - selectors must be passed in
  return (rows, artistSel, dateSel, venueSel) => {
    return rows.map(row => {
      // Extract artists - filter to non-profiled links (actual performers)
      const artistElements = Array.from(row.querySelectorAll(artistSel)).filter(a =>
        a.classList.contains('non-profiled') || a.className.trim() === ''
      );
      const artists = artistElements.map(a => a.textContent.trim()).filter(Boolean);

      // Extract date/time from datetime attribute
      const dateTimeEl = row.querySelector(dateSel);
      const datetimeAttr = dateTimeEl?.getAttribute('title') || '';

      let date = 'Unknown';
      let time = 'Unknown';

      if (datetimeAttr) {
        try {
          const dt = new Date(datetimeAttr);
          if (!isNaN(dt.getTime())) {
            date = dt.toLocaleDateString('en-US');
            time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          }
        } catch {
          // Keep defaults
        }
      }

      // Extract venue
      const venueEl = row.querySelector(venueSel);
      const venue = venueEl?.textContent.trim() || 'Unknown Venue';

      return { artists, date, time, venue };
    });
  };
}

/**
 * Parses raw scraped data into clean show objects.
 * Filters out invalid entries.
 *
 * @param {Array} rawShows - Raw scraped show data
 * @returns {Array} Cleaned show objects
 */
function parseShows(rawShows) {
  return rawShows
    .filter(show => {
      // Must have at least one artist
      if (!show.artists || show.artists.length === 0) return false;
      // Must have a venue
      if (!show.venue || show.venue === 'Unknown Venue') return false;
      return true;
    })
    .map(show => ({
      artists: show.artists,
      venue: show.venue,
      date: show.date,
      time: show.time,
    }));
}

/**
 * Gets the selectors needed for browser-side extraction.
 * @returns {Object} Selector strings
 */
function getSelectors() {
  return {
    showRow: config.selectors.showRow,
    artistLinks: config.selectors.artistLinks,
    dateTime: config.selectors.dateTimeAttr,
    venue: config.selectors.venue,
  };
}

module.exports = {
  createShowExtractor,
  parseShows,
  getSelectors,
};
