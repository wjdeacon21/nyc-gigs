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

  // Pagination
  startPage: 1,
  endPage: parseInt(process.env.SCRAPER_PAGES, 10) || 30,

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

  // Rate limiting
  delayBetweenPages: parseInt(process.env.SCRAPER_DELAY_MS, 10) || 1000,
};

/**
 * Builds the URL for a specific page.
 * @param {number} pageNum - Page number
 * @returns {string} Full URL
 */
function buildPageUrl(pageNum) {
  if (pageNum === 1) {
    return `${config.baseUrl}${config.showsPath}`;
  }
  return `${config.baseUrl}${config.showsPath}?page=${pageNum}`;
}

module.exports = { config, buildPageUrl };
