/**
 * Centralized configuration for the Concert Notify application.
 * All environment variables and constants are defined here.
 */

require('dotenv').config();

const path = require('path');

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 8888,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Spotify OAuth
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI || `http://localhost:${process.env.PORT || 8888}/callback`,
    scopes: [
      'user-read-private',
      'user-read-email',
      'user-top-read',
      'user-read-currently-playing',
      'user-library-read',
    ].join(' '),
    tokenUrl: 'https://accounts.spotify.com/api/token',
    authorizeUrl: 'https://accounts.spotify.com/authorize',
    apiBaseUrl: 'https://api.spotify.com/v1',
  },

  // Show data sources
  shows: {
    // Local file path (primary source - written by scraper)
    localPath: process.env.SHOWS_LOCAL_PATH || path.resolve(__dirname, '../..', 'data/shows.json'),

    // Remote URL (fallback if local file doesn't exist)
    remoteUrl: process.env.SHOWS_REMOTE_URL ||
      'https://raw.githubusercontent.com/wjdeacon21/scrapedShows/main/data/shows_recent.json',
  },
};

// Validate required configuration
function validateConfig() {
  const required = [
    ['SPOTIFY_CLIENT_ID', config.spotify.clientId],
    ['SPOTIFY_CLIENT_SECRET', config.spotify.clientSecret],
  ];

  const missing = required.filter(([name, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };
