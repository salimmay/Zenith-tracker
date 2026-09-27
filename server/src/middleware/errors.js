const { HttpError } = require('../lib/errors');

function notFoundHandler(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.path}` });
}

// Every error leaves the API as { message, ...extra } with a real status code.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...err.extra });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'That already exists' });
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ message: err.message });
  }
  console.error('[error]', err);
  res.status(500).json({ message: 'Something went wrong on our side' });
}

module.exports = { notFoundHandler, errorHandler };
