function createHttpError(statusCode, code, message, details) {
  const err = new Error(message || 'Request failed');
  err.statusCode = statusCode;
  err.code = code || 'error';
  if (details !== undefined) err.details = details;
  return err;
}

module.exports = { createHttpError };

