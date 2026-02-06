/**
 * API routes for fetching artist and show data.
 */

const express = require('express');
const { logger } = require('../utils');
const spotify = require('../services/spotify');
const shows = require('../services/shows');
const tokenStore = require('../services/tokenStore');

const router = express.Router();

/**
 * Middleware to validate userId parameter.
 */
function requireUserId(req, res, next) {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!tokenStore.has(userId)) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  req.userId = userId;
  next();
}

/**
 * Standardized error handler for API routes.
 */
function handleApiError(res, error, defaultMessage) {
  logger.error(defaultMessage, { error: error.message });

  if (error.message === 'User not authenticated') {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (error.message === 'Failed to refresh token') {
    return res.status(401).json({ error: 'Authentication expired. Please log in again.' });
  }

  res.status(500).json({ error: defaultMessage });
}

/**
 * GET /api/top-artists
 * Returns the user's top 50 artists from Spotify.
 */
router.get('/top-artists', requireUserId, async (req, res) => {
  try {
    const topArtists = await spotify.getTopArtists(req.userId);
    res.json({ topArtists });
  } catch (error) {
    handleApiError(res, error, 'Failed to get top artists');
  }
});

/**
 * GET /api/liked-artists
 * Returns all unique artists from the user's liked songs.
 */
router.get('/liked-artists', requireUserId, async (req, res) => {
  try {
    const likedArtists = await spotify.getLikedArtists(req.userId);
    res.json({ likedArtists });
  } catch (error) {
    handleApiError(res, error, 'Failed to get liked artists');
  }
});

/**
 * GET /api/upcoming-shows
 * Returns upcoming concert/show data.
 * This endpoint does not require authentication.
 */
router.get('/upcoming-shows', async (req, res) => {
  try {
    const upcomingShows = await shows.getUpcomingShows();
    res.json({ upcomingShows });
  } catch (error) {
    logger.error('Failed to fetch upcoming shows', { error: error.message });
    res.status(500).json({ error: 'Failed to get upcoming shows' });
  }
});

/**
 * GET /api/search
 * Search for an artist and get their top track.
 */
router.get('/search', requireUserId, async (req, res) => {
  const { artist } = req.query;

  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required' });
  }

  try {
    const result = await spotify.searchArtistTopTrack(req.userId, artist);
    res.json(result);
  } catch (error) {
    if (error.message === 'Artist not found') {
      return res.status(404).json({ error: 'Artist not found' });
    }
    if (error.message === 'No tracks found for this artist') {
      return res.status(404).json({ error: 'No tracks found for this artist' });
    }
    handleApiError(res, error, 'Failed to fetch artist information');
  }
});

module.exports = router;
