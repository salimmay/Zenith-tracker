const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized } = require('../lib/errors');

// Accepts `Authorization: Bearer <jwt>` (current app) and `x-auth-token`
// (v1 web client), so old tokens keep working until they expire.
function readToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.get('x-auth-token') || null;
}

function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(unauthorized('Sign in to continue'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = payload.userId;
    next();
  } catch {
    next(unauthorized('Your session has expired, sign in again', { sessionExpired: true }));
  }
}

function signToken(userId) {
  return jwt.sign({ userId: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

module.exports = { requireAuth, signToken };
