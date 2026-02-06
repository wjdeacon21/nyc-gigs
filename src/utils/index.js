/**
 * Web app utilities.
 * Re-exports shared utilities plus web-specific helpers.
 */

const { logger } = require('../shared/logger');

/**
 * Generates a cryptographically random string for OAuth state parameter.
 * @param {number} length - Length of the string to generate
 * @returns {string} Random alphanumeric string
 */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Creates a Basic Auth header value from client credentials.
 * @param {string} clientId - Spotify client ID
 * @param {string} clientSecret - Spotify client secret
 * @returns {string} Base64-encoded credentials for Authorization header
 */
function encodeClientCredentials(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

module.exports = {
  generateRandomString,
  encodeClientCredentials,
  logger,
};
