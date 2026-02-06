/**
 * In-memory token store for user sessions.
 *
 * IMPORTANT: This is suitable for development only.
 * For production, replace with Redis or a database-backed store
 * to support horizontal scaling and persistence across restarts.
 */

const { logger } = require('../utils');

class TokenStore {
  constructor() {
    this.tokens = new Map();
  }

  /**
   * Store tokens for a user session.
   * @param {string} userId - Session identifier
   * @param {Object} tokenData - Token data to store
   * @param {string} tokenData.accessToken - Spotify access token
   * @param {string} tokenData.refreshToken - Spotify refresh token
   * @param {number} tokenData.expiresIn - Token lifetime in seconds
   * @param {string} [tokenData.username] - User's display name
   */
  set(userId, { accessToken, refreshToken, expiresIn, username }) {
    this.tokens.set(userId, {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn * 1000),
      username,
    });
    logger.debug('Token stored', { userId, username });
  }

  /**
   * Retrieve tokens for a user session.
   * @param {string} userId - Session identifier
   * @returns {Object|null} Token data or null if not found
   */
  get(userId) {
    return this.tokens.get(userId) || null;
  }

  /**
   * Check if a user session exists.
   * @param {string} userId - Session identifier
   * @returns {boolean}
   */
  has(userId) {
    return this.tokens.has(userId);
  }

  /**
   * Update the access token after a refresh.
   * @param {string} userId - Session identifier
   * @param {string} accessToken - New access token
   * @param {number} expiresIn - Token lifetime in seconds
   */
  updateAccessToken(userId, accessToken, expiresIn) {
    const existing = this.tokens.get(userId);
    if (existing) {
      existing.accessToken = accessToken;
      existing.expiresAt = Date.now() + (expiresIn * 1000);
      logger.debug('Token refreshed', { userId });
    }
  }

  /**
   * Check if a token is expired.
   * @param {string} userId - Session identifier
   * @returns {boolean}
   */
  isExpired(userId) {
    const token = this.tokens.get(userId);
    if (!token) return true;
    return Date.now() >= token.expiresAt;
  }

  /**
   * Remove a user session.
   * @param {string} userId - Session identifier
   */
  delete(userId) {
    this.tokens.delete(userId);
    logger.debug('Token removed', { userId });
  }
}

// Singleton instance
module.exports = new TokenStore();
