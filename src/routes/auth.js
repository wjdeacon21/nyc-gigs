/**
 * Authentication routes for Spotify OAuth flow.
 */

const express = require('express');
const querystring = require('querystring');
const { config } = require('../config');
const { generateRandomString, logger } = require('../utils');
const spotify = require('../services/spotify');
const tokenStore = require('../services/tokenStore');

const router = express.Router();

/**
 * GET /login
 * Initiates the Spotify OAuth authorization flow.
 * Redirects user to Spotify's authorization page.
 */
router.get('/login', (req, res) => {
  const state = generateRandomString(16);

  const authorizeUrl = `${config.spotify.authorizeUrl}?${querystring.stringify({
    response_type: 'code',
    client_id: config.spotify.clientId,
    scope: config.spotify.scopes,
    redirect_uri: config.spotify.redirectUri,
    state,
  })}`;

  logger.info('Initiating OAuth flow');
  res.redirect(authorizeUrl);
});

/**
 * GET /callback
 * OAuth callback endpoint. Exchanges authorization code for tokens.
 * On success, redirects to frontend with tokens in URL hash.
 */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('OAuth error from Spotify', { error });
    return res.redirect(`/#${querystring.stringify({ error })}`);
  }

  if (!state) {
    logger.warn('OAuth callback missing state parameter');
    return res.redirect(`/#${querystring.stringify({ error: 'state_mismatch' })}`);
  }

  try {
    // Exchange code for tokens
    const tokenData = await spotify.exchangeCodeForTokens(code);

    // Get user profile
    const userProfile = await spotify.getCurrentUser(tokenData.access_token);

    // Generate session ID and store tokens
    const userId = generateRandomString(16);
    tokenStore.set(userId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      username: userProfile.display_name,
    });

    logger.info('User authenticated successfully', {
      userId,
      username: userProfile.display_name
    });

    // Redirect to frontend with session info
    res.redirect(`/#${querystring.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      userId,
      username: userProfile.display_name,
    })}`);

  } catch (error) {
    logger.error('OAuth token exchange failed', { error: error.message });
    res.redirect(`/#${querystring.stringify({ error: 'invalid_token' })}`);
  }
});

/**
 * GET /refresh_token
 * Refreshes an expired access token.
 */
router.get('/refresh_token', async (req, res) => {
  const { refresh_token } = req.query;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  try {
    const data = await spotify.refreshAccessToken(refresh_token);

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
    });
  } catch (error) {
    logger.error('Token refresh failed', { error: error.message });
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;
