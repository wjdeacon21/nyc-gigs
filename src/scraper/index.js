/**
 * OhMyRockness Scraper
 *
 * Scrapes upcoming concert listings and outputs clean JSON.
 *
 * Usage:
 *   node src/scraper/index.js           # Run scraper, output to data/shows.json
 *   node src/scraper/index.js --dry-run # Scrape but don't save
 *
 * Environment variables:
 *   SCRAPER_PAGES       - Number of pages to scrape (default: 5)
 *   SCRAPER_OUTPUT_DIR  - Output directory (default: data)
 *   SCRAPER_DELAY_MS    - Delay between pages in ms (default: 1000)
 *   LOG_LEVEL           - debug|info|warn|error (default: info)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const { config, buildPageUrl } = require('./config');
const { parseShows, getSelectors } = require('./parsers');
const { logger } = require('../shared/logger');
const { validateShows } = require('../shared/types');

/**
 * Scrapes a single page of shows.
 * @param {puppeteer.Page} page - Puppeteer page instance
 * @param {number} pageNum - Page number to scrape
 * @returns {Promise<Array>} Raw show data from page
 */
async function scrapePage(page, pageNum) {
  const url = buildPageUrl(pageNum);
  logger.info(`Scraping page ${pageNum}`, { url });

  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: config.puppeteer.timeout,
  });

  const selectors = getSelectors();

  // Extract shows using browser-side evaluation
  const rawShows = await page.$$eval(
    selectors.showRow,
    (rows, artistSel, dateSel, venueSel) => {
      return rows.map(row => {
        // Extract artists
        const artistElements = Array.from(row.querySelectorAll(artistSel)).filter(a =>
          a.classList.contains('non-profiled') || a.className.trim() === ''
        );
        const artists = artistElements.map(a => a.textContent.trim()).filter(Boolean);

        // Extract date/time
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
    },
    selectors.artistLinks,
    selectors.dateTime,
    selectors.venue
  );

  logger.debug(`Found ${rawShows.length} shows on page ${pageNum}`);
  return rawShows;
}

/**
 * Main scraper function. Scrapes all configured pages in parallel.
 * @returns {Promise<Array>} All scraped and validated shows
 */
async function scrape() {
  logger.info('Starting scraper', {
    pages: `${config.startPage}-${config.endPage}`,
    baseUrl: config.baseUrl,
  });

  const browser = await puppeteer.launch({
    headless: config.puppeteer.headless,
    args: config.puppeteer.args,
  });

  const allShows = [];
  const CONCURRENT_PAGES = 3; // Scrape 3 pages at a time

  try {
    const pageNumbers = [];
    for (let i = config.startPage; i <= config.endPage; i++) {
      pageNumbers.push(i);
    }

    // Process pages in batches for parallel scraping
    for (let i = 0; i < pageNumbers.length; i += CONCURRENT_PAGES) {
      const batch = pageNumbers.slice(i, i + CONCURRENT_PAGES);

      const batchPromises = batch.map(async (pageNum) => {
        const page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        );

        try {
          const pageShows = await scrapePage(page, pageNum);
          return pageShows;
        } catch (error) {
          logger.error(`Failed to scrape page ${pageNum}`, { error: error.message });
          return [];
        } finally {
          await page.close();
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const shows of batchResults) {
        allShows.push(...shows);
      }

      // Small delay between batches to be polite to the server
      if (i + CONCURRENT_PAGES < pageNumbers.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } finally {
    await browser.close();
  }

  // Parse and validate
  const parsedShows = parseShows(allShows);
  const validShows = validateShows(parsedShows);

  logger.info('Scraping complete', {
    raw: allShows.length,
    valid: validShows.length,
  });

  return validShows;
}

/**
 * Saves shows to JSON file.
 * @param {Array} shows - Shows to save
 * @param {Object} [options]
 * @param {boolean} [options.keepHistory] - Also save timestamped version
 */
async function saveShows(shows, { keepHistory = false } = {}) {
  const outputDir = path.resolve(config.output.directory);

  // Ensure directory exists (async)
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Always save to latest file
  const latestPath = path.join(outputDir, config.output.latestFilename);
  await fs.promises.writeFile(latestPath, JSON.stringify(shows, null, 2));
  logger.info(`Saved ${shows.length} shows to ${latestPath}`);

  // Optionally save timestamped version
  if (keepHistory) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const historyPath = path.join(outputDir, `shows_${timestamp}.json`);
    await fs.promises.writeFile(historyPath, JSON.stringify(shows, null, 2));
    logger.debug(`Saved history to ${historyPath}`);
  }
}

/**
 * Loads shows from the latest JSON file.
 * @returns {Promise<Array>} Shows array
 */
async function loadShows() {
  const filePath = path.resolve(config.output.directory, config.output.latestFilename);

  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    logger.warn('No shows file found', { path: filePath });
    return [];
  }

  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    const shows = await scrape();

    if (dryRun) {
      logger.info('Dry run - not saving', { showCount: shows.length });
      console.log(JSON.stringify(shows.slice(0, 5), null, 2));
      console.log(`... and ${shows.length - 5} more`);
    } else {
      await saveShows(shows, { keepHistory: config.output.keepHistory });
    }

    process.exit(0);
  } catch (error) {
    logger.error('Scraper failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  scrape,
  saveShows,
  loadShows,
};
