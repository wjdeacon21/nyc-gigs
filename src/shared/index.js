/**
 * Shared utilities index.
 * Re-exports all shared modules for convenient imports.
 */

module.exports = {
  ...require('./types'),
  ...require('./normalize'),
  ...require('./logger'),
};
