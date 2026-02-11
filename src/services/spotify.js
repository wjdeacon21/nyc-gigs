/**
 * Spotify API client.
 * Handles all interactions with the Spotify Web API.
 */

const axios = require('axios');
const querystring = require('querystring');
const { config } = require('../config');
const { encodeClientCredentials, logger } = require('../utils');
const tokenStore = require('./tokenStore');

const authHeader = {
  Authorization: `Basic ${encodeClientCredentials(config.spotify.clientId, config.spotify.clientSecret)}`,
  'Content-Type': 'application/x-www-form-urlencoded',
};

// Simple in-memory cache for API responses
const apiCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = apiCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  apiCache.delete(key);
  return null;
}

function setCache(key, data) {
  apiCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<Object>} Token response from Spotify
 */
async function exchangeCodeForTokens(code) {
  const response = await axios.post(
    config.spotify.tokenUrl,
    querystring.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.spotify.redirectUri,
    }),
    { headers: authHeader }
  );
  return response.data;
}

/**
 * Refresh an expired access token.
 * @param {string} refreshToken - Spotify refresh token
 * @returns {Promise<Object>} New token data
 */
async function refreshAccessToken(refreshToken) {
  const response = await axios.post(
    config.spotify.tokenUrl,
    querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    { headers: authHeader }
  );
  return response.data;
}

/**
 * Ensures the user has a valid (non-expired) access token.
 * Automatically refreshes if needed.
 * @param {string} userId - Session identifier
 * @returns {Promise<string>} Valid access token
 * @throws {Error} If user not found or refresh fails
 */
async function ensureValidToken(userId) {
  const userToken = tokenStore.get(userId);

  if (!userToken) {
    throw new Error('User not authenticated');
  }

  if (tokenStore.isExpired(userId)) {
    logger.debug('Token expired, refreshing', { userId });
    try {
      const data = await refreshAccessToken(userToken.refreshToken);
      tokenStore.updateAccessToken(userId, data.access_token, data.expires_in);
      return data.access_token;
    } catch (error) {
      logger.error('Token refresh failed', { userId, error: error.message });
      throw new Error('Failed to refresh token');
    }
  }

  return userToken.accessToken;
}

/**
 * Make an authenticated request to the Spotify API.
 * @param {string} endpoint - API endpoint (relative to base URL)
 * @param {string} accessToken - Valid access token
 * @param {Object} [options] - Axios request options
 * @returns {Promise<Object>} API response data
 */
async function apiRequest(endpoint, accessToken, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${config.spotify.apiBaseUrl}${endpoint}`;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        url,
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...options.headers,
        },
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '1', 10);
        logger.debug('Rate limited by Spotify, retrying', { endpoint, attempt, retryAfter });
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Get the current user's profile.
 * @param {string} accessToken - Valid access token
 * @returns {Promise<Object>} User profile data
 */
async function getCurrentUser(accessToken) {
  return apiRequest('/me', accessToken);
}

/**
 * Get the user's top artists.
 * @param {string} userId - Session identifier
 * @param {number} [limit=50] - Number of artists to fetch (max 50)
 * @returns {Promise<Array>} Array of artist objects
 */
async function getTopArtists(userId, limit = 50) {
  const cacheKey = `top-artists:${userId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.debug('Returning cached top artists', { userId });
    return cached;
  }

  const accessToken = await ensureValidToken(userId);
  const data = await apiRequest(`/me/top/artists?limit=${limit}`, accessToken);

  const result = data.items.map(artist => ({
    name: artist.name,
    image: artist.images[0]?.url,
    genres: artist.genres,
    url: artist.external_urls.spotify,
  }));

  setCache(cacheKey, result);
  return result;
}

/**
 * Get unique artists from the user's liked songs.
 * Set SPOTIFY_MAX_LIKED_PAGES env var to limit pages (0 = unlimited).
 * @param {string} userId - Session identifier
 * @returns {Promise<Array>} Array of unique artist objects
 */
async function getLikedArtists(userId) {
  const cacheKey = `liked-artists:${userId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    logger.debug('Returning cached liked artists', { userId });
    return cached;
  }

  const accessToken = await ensureValidToken(userId);
  const artistsMap = new Map();
  const limit = 50;

  // 0 = unlimited, otherwise limits to N pages (N * 50 songs)
  const maxPages = parseInt(process.env.SPOTIFY_MAX_LIKED_PAGES || '10', 10);

  // Fetch first page to get total count
  const firstPage = await apiRequest(`/me/tracks?limit=${limit}&offset=0`, accessToken);

  const collectArtists = (data) => {
    for (const item of data.items) {
      if (!item.track?.artists) continue;
      for (const artist of item.track.artists) {
        if (!artistsMap.has(artist.id)) {
          artistsMap.set(artist.id, {
            name: artist.name,
            url: artist.external_urls.spotify,
          });
        }
      }
    }
  };

  collectArtists(firstPage);

  // Calculate remaining pages and fetch in parallel
  const total = firstPage.total;
  const maxItems = maxPages === 0 ? total : Math.min(total, maxPages * limit);
  const remainingOffsets = [];
  for (let offset = limit; offset < maxItems; offset += limit) {
    remainingOffsets.push(offset);
  }

  if (remainingOffsets.length > 0) {
    const chunkSize = 3;
    for (let i = 0; i < remainingOffsets.length; i += chunkSize) {
      const chunk = remainingOffsets.slice(i, i + chunkSize);
      const pages = await Promise.all(
        chunk.map(offset =>
          apiRequest(`/me/tracks?limit=${limit}&offset=${offset}`, accessToken)
        )
      );
      pages.forEach(collectArtists);
    }
  }

  const pageCount = 1 + remainingOffsets.length;
  const result = Array.from(artistsMap.values());
  setCache(cacheKey, result);
  logger.debug('Fetched liked artists', { userId, count: result.length, pages: pageCount, maxPages: maxPages || 'unlimited' });
  return result;
}

/**
 * Search for an artist and get their top track.
 * @param {string} userId - Session identifier
 * @param {string} artistName - Artist name to search
 * @returns {Promise<Object>} Top track info
 */
async function searchArtistTopTrack(userId, artistName) {
  const accessToken = await ensureValidToken(userId);

  const searchData = await apiRequest(
    `/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
    accessToken
  );

  const artistId = searchData.artists.items[0]?.id;
  if (!artistId) {
    throw new Error('Artist not found');
  }

  const tracksData = await apiRequest(`/artists/${artistId}/top-tracks?market=US`, accessToken);
  const topTrack = tracksData.tracks[0];

  if (!topTrack) {
    throw new Error('No tracks found for this artist');
  }

  return {
    songName: topTrack.name,
    artistName: topTrack.artists[0].name,
    albumCover: topTrack.album.images[0]?.url,
  };
}

module.exports = {
  exchangeCodeForTokens,
  refreshAccessToken,
  ensureValidToken,
  getCurrentUser,
  getTopArtists,
  getLikedArtists,
  searchArtistTopTrack,
};
