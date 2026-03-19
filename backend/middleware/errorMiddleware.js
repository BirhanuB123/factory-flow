const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${err.value}`;
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message);
    error = { message, statusCode: 400 };
  }

  const msg = error.message || 'Server Error';
  const errorText = Array.isArray(msg) ? msg.join(', ') : msg;
  const httpStatus = error.statusCode || err.statusCode || 500;

  if (httpStatus >= 500) {
    logger.error({ err: err.message, stack: err.stack }, 'request error');
  }

  res.status(httpStatus).json({
    success: false,
    error: msg,
    message: errorText,
  });
};

module.exports = errorHandler;
