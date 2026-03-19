require('./config/loadEnv');
const logger = require('./config/logger');
const connectDB = require('./config/db');
const app = require('./app');

const PORT = Number(process.env.PORT) || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info({ port: PORT, nodeEnv: process.env.NODE_ENV || 'development' }, 'Server listening');
    });
  })
  .catch((err) => {
    logger.fatal({ err: err.message }, 'MongoDB connection failed');
    process.exit(1);
  });
