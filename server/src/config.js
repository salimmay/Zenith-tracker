// Central place for environment configuration. Every secret comes from the
// environment — nothing sensitive is hardcoded in source.
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  tmdbApiKey: process.env.TMDB_API_KEY || '',
  trakt: {
    clientId: process.env.TRAKT_CLIENT_ID || '',
    clientSecret: process.env.TRAKT_CLIENT_SECRET || '',
    // Must match a Redirect URI registered on the Trakt app. Device login never
    // uses it, but Trakt checks it when refreshing tokens.
    redirectUri: process.env.TRAKT_REDIRECT_URI || 'https://zenith-tracker-api.web.app/trakt',
  },
  // Comma-separated list of allowed browser origins. Native apps send no
  // Origin header and are always allowed.
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

if (!config.tmdbApiKey) {
  console.warn('[config] WARNING: TMDB_API_KEY is not set. Catalog and TMDB metadata features will be unavailable.');
}

config.trakt.enabled = Boolean(config.trakt.clientId && config.trakt.clientSecret);

module.exports = config;
