/**
 * Scraper configuration.
 *
 * All scraper-specific settings in one place.
 * Edit this file when OhMyRockness changes their site structure.
 */

require('dotenv').config();

const config = {
  // Target site
  baseUrl: process.env.SCRAPER_BASE_URL || 'https://www.ohmyrockness.com',
  showsPath: '/shows',

  // Puppeteer settings
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
    timeout: 30000,
  },

  // CSS Selectors - UPDATE THESE when the site changes
  selectors: {
    showRow: '.row.vevent',
    artistLinks: '.bands.summary a',
    dateTimeAttr: '.value-title',
    venue: '.fn.org',
  },

  // Output settings
  output: {
    directory: process.env.SCRAPER_OUTPUT_DIR || 'data',
    latestFilename: 'shows.json',
    keepHistory: process.env.SCRAPER_KEEP_HISTORY === 'true',
  },

};

/**
 * Builds the URL for all shows.
 * @returns {string} Full URL with all=true query param
 */
function buildShowsUrl() {
  return `${config.baseUrl}${config.showsPath}?all=true`;
}

module.exports = { config, buildShowsUrl };
