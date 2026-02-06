/**
 * Concert Notify - Main Server
 *
 * Express server that handles:
 * - Spotify OAuth authentication
 * - API endpoints for artist and show data
 * - Static file serving for the frontend
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const { config, validateConfig } = require('./config');
const { logger } = require('./utils');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

// Validate configuration before starting
validateConfig();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging (simple middleware)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.debug('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use(authRoutes);
app.use('/api', apiRoutes);

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (require.main === module) {
  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Server started`, {
      port: config.port,
      env: config.nodeEnv,
      redirectUri: config.spotify.redirectUri,
    });
  });
}

module.exports = app;
