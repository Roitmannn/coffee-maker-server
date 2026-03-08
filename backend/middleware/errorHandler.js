const { logger } = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'not_found',
      message: 'Route not found'
    }
  });
}

function errorHandler(err, req, res, _next) {
  const statusCode = Number.isFinite(err.statusCode) ? err.statusCode : 500;
  const code = err.code || (statusCode === 500 ? 'internal_error' : 'error');
  const message = err.message || 'Unexpected error';

  if (statusCode >= 500) {
    logger.error('unhandled_error', {
      path: req.originalUrl,
      method: req.method,
      message,
      stack: err.stack
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: err.details
    }
  });
}

module.exports = { notFoundHandler, errorHandler };

