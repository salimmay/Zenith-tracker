const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { connectDB } = require('./db');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const { requireAuth } = require('./middleware/auth');
const { HttpError } = require('./lib/errors');

const app = express();

app.set('trust proxy', 1); // behind Vercel's proxy — needed for per-IP rate limits
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Native apps send no Origin; browsers must be on the allow-list in production.
      if (!origin || config.env !== 'production' || config.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(null, false);
    },
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => res.json({ name: 'Zenith Tracker API', version: 2 }));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Touches the database. A weekly scheduler ping here keeps a free Atlas cluster
// from auto-pausing after 60 idle days.
app.get('/health/db', async (_req, res) => {
  try {
    const conn = await connectDB();
    await conn.db.admin().ping();
    res.json({ ok: true, db: 'up' });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

// Public app config. `ads.enabled` is a remote kill switch for every ad slot.
app.get('/api/config', (_req, res) => {
  res.json({ ads: { enabled: process.env.ADS_ENABLED !== 'false' } });
});

// TMDB-only routes: no database needed, so search keeps working if Mongo is down.
app.use('/api/catalog', require('./routes/catalog'));

// Open (or reuse) the database connection. Runs after auth, so a request
// without a valid token gets its 401 without touching the database.
async function db(_req, _res, next) {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    next(new HttpError(503, 'Database unavailable, try again shortly'));
  }
}

const library = require('./routes/library');
app.use('/api/auth', db, require('./routes/auth')); // mixes public and private routes
app.use('/api/library', requireAuth, db, library);
app.use('/api/watchlist', requireAuth, db, library); // v1 path
app.use('/api/calendar', requireAuth, db, require('./routes/calendar'));
app.use('/api/trakt', requireAuth, db, require('./routes/trakt'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
