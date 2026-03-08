const { env } = require('./config/env');
const { logger } = require('./utils/logger');
const { createApp } = require('./app');

const app = createApp();

app.listen(env.port, () => {
  logger.info('server_started', {
    port: env.port,
    node_env: env.nodeEnv
  });
});

