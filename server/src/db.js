const mongoose = require('mongoose');
const config = require('./config');

// Cache the connection promise on the module so serverless invocations that
// reuse a warm instance don't open a new connection per request.
let connecting = null;
let migrated = false;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connecting) {
    connecting = mongoose
      .connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 })
      .then(async (m) => {
        if (!migrated) {
          migrated = true;
          await migrateLegacyData().catch((err) =>
            console.error('[db] legacy migration failed:', err.message)
          );
        }
        return m.connection;
      })
      .catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
      });
  }
  return connecting;
}

/**
 * Idempotent upgrade of documents written by the first version of the API:
 *  - shows had no `mediaType` (everything was TV)
 *  - statuses were sometimes stored with capital letters
 *  - the unique index was (userId, tmdbId), which blocks a movie and a show
 *    that share a TMDB id — replaced by (userId, tmdbId, mediaType)
 */
async function migrateLegacyData() {
  const Show = require('./models/Show');
  const shows = Show.collection;

  await shows.updateMany({ mediaType: { $exists: false } }, { $set: { mediaType: 'tv' } });
  await shows.updateMany({ status: { $regex: /[A-Z]/ } }, [
    { $set: { status: { $toLower: '$status' } } },
  ]);

  const indexes = await shows.indexes().catch(() => []);
  if (indexes.some((i) => i.name === 'userId_1_tmdbId_1')) {
    await shows.dropIndex('userId_1_tmdbId_1');
  }
  await Show.syncIndexes();
}

module.exports = { connectDB };
