/**
 * Concert/show data service.
 *
 * Loads show data from local JSON file (produced by scraper)
 * or falls back to remote URL.
 *
 * Data flow:
 *   scraper runs → writes data/shows.json → web app reads it
 *
 * Expected show structure (flat, clean):
 * {
 *   artists: string[],
 *   venue: string,
 *   date: string,
 *   time: string
 * }
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { config } = require('../config');
const { logger } = require('../shared/logger');
const { validateShows } = require('../shared/types');

// Cache for show data
let cachedShows = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Attempts to load shows from local file first, then remote.
 * @returns {Promise<Array>} Array of show objects
 */
async function getUpcomingShows() {
  // Return cached data if still valid
  if (cachedShows && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) {
    logger.debug('Returning cached shows data');
    return cachedShows;
  }

  let shows = null;

  // Try local file first
  shows = await loadFromLocalFile();

  // Fall back to remote if local fails
  if (!shows) {
    shows = await loadFromRemote();
  }

  if (!shows) {
    throw new Error('Failed to load shows from any source');
  }

  // Validate and cache
  const validShows = validateShows(shows);
  cachedShows = validShows;
  cacheTimestamp = Date.now();

  logger.info('Shows loaded successfully', { count: validShows.length });
  return validShows;
}

/**
 * Load shows from local JSON file.
 * @returns {Promise<Array|null>}
 */
async function loadFromLocalFile() {
  const localPath = path.resolve(config.shows.localPath);

  try {
    // Use async access check instead of blocking existsSync
    try {
      await fs.promises.access(localPath, fs.constants.R_OK);
    } catch {
      logger.debug('Local shows file not found', { path: localPath });
      return null;
    }

    const content = await fs.promises.readFile(localPath, 'utf-8');
    const shows = JSON.parse(content);

    if (!Array.isArray(shows)) {
      logger.warn('Local shows file has invalid format');
      return null;
    }

    logger.info('Loaded shows from local file', { path: localPath, count: shows.length });
    return shows;
  } catch (error) {
    logger.error('Failed to load local shows file', { error: error.message });
    return null;
  }
}

/**
 * Load shows from remote URL (legacy support).
 * @returns {Promise<Array|null>}
 */
async function loadFromRemote() {
  if (!config.shows.remoteUrl) {
    return null;
  }

  try {
    logger.info('Fetching shows from remote', { url: config.shows.remoteUrl });

    const response = await axios.get(config.shows.remoteUrl, {
      timeout: 10000,
    });

    let shows = response.data;

    // Handle legacy nested format: { name: { artists, ... } }
    if (Array.isArray(shows) && shows[0]?.name?.artists) {
      logger.debug('Converting legacy nested format');
      shows = shows.map(s => s.name);
    }

    // Handle double-nested format: { name: { name: { artists, ... } } }
    if (Array.isArray(shows) && shows[0]?.name?.name?.artists) {
      logger.debug('Converting double-nested legacy format');
      shows = shows.map(s => s.name.name);
    }

    return shows;
  } catch (error) {
    logger.error('Failed to fetch remote shows', { error: error.message });
    return null;
  }
}

/**
 * Clear the shows cache.
 */
function clearCache() {
  cachedShows = null;
  cacheTimestamp = null;
}

/**
 * Force reload from source (bypasses cache).
 * @returns {Promise<Array>}
 */
async function refreshShows() {
  clearCache();
  return getUpcomingShows();
}

module.exports = {
  getUpcomingShows,
  clearCache,
  refreshShows,
};
