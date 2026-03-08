const { logger } = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms,
      ip: req.ip
    });
  });

  next();
}

module.exports = { requestLogger };

