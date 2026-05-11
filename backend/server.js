require('./config/loadEnv');
const logger = require('./config/logger');
const connectDB = require('./config/db');
const app = require('./app');
const { startTrialAutoSuspendScheduler } = require('./services/trialLifecycleService');

const PORT = Number(process.env.PORT) || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info({ port: PORT, nodeEnv: process.env.NODE_ENV || 'development' }, 'Server listening');
      startTrialAutoSuspendScheduler();
    });
  })
  .catch((err) => {
    logger.fatal({ err: err.message }, 'MongoDB connection failed');
    process.exit(1);
  });
