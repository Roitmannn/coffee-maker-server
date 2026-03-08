const express = require('express');
const { requestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const coffeeRoutes = require('./routes/coffeeRoutes');
const healthRoutes = require('./routes/healthRoutes');
const debugRoutes = require('./routes/debugRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const adminRoutes = require('./routes/adminRoutes');

function createApp() {
  const app = express();

  // If you deploy behind a proxy (DigitalOcean App Platform, etc.), trust it for req.ip.
  app.set('trust proxy', true);

  app.use(express.json({ limit: '64kb' }));
  app.use(requestLogger);

  app.use('/api', healthRoutes);
  app.use('/api/coffee', coffeeRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', deviceRoutes);
  app.use('/api', debugRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

