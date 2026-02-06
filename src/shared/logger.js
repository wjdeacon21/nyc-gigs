/**
 * Shared structured logger.
 *
 * Simple JSON logger that works for both web app and scraper.
 * In production, consider replacing with pino or winston.
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function formatMessage(level, message, meta = {}) {
  return JSON.stringify({
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  });
}

const logger = {
  debug: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  },

  info: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },

  warn: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error: (message, meta) => {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
};

module.exports = { logger };
