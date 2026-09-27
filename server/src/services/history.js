const mongoose = require('mongoose');
const History = require('../models/History');
const Show = require('../models/Show');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

function recordEpisodes(userId, show, episodes, { source = 'app', watchedAt = new Date() } = {}) {
  if (!episodes.length) return Promise.resolve();
  return History.insertMany(
    episodes.map((ep) => ({
      userId,
      tmdbId: show.tmdbId,
      mediaType: 'tv',
      season: ep.season,
      episode: ep.episode,
      minutes: show.runtime || 0,
      watchedAt,
      source,
    }))
  );
}

function removeEpisodes(userId, tmdbId, episodes) {
  if (!episodes.length) return Promise.resolve();
  return History.deleteMany({
    userId,
    tmdbId,
    mediaType: 'tv',
    $or: episodes.map((ep) => ({ season: ep.season, episode: ep.episode })),
  });
}

/** Episodes we know were watched but not individually when (Trakt pulls, imports). */
function recordBatch(userId, show, count, { source, watchedAt }) {
  if (count <= 0) return Promise.resolve();
  return History.create({
    userId,
    tmdbId: show.tmdbId,
    mediaType: show.mediaType,
    episodes: count,
    minutes: count * (show.runtime || 0),
    watchedAt: watchedAt || new Date(),
    source,
  });
}

function recordMovie(userId, show, watchedAt = new Date()) {
  return History.create({
    userId,
    tmdbId: show.tmdbId,
    mediaType: 'movie',
    minutes: show.runtime || 0,
    watchedAt,
  });
}

async function removeMovie(userId, tmdbId) {
  const last = await History.findOne({ userId, tmdbId, mediaType: 'movie' }).sort({ watchedAt: -1 });
  if (last) await last.deleteOne();
}

/**
 * Libraries created before history existed get one "import" row per title,
 * dated at its last watch, so stats aren't empty on day one. Runs once per user.
 */
async function ensureBackfill(userId) {
  if (await History.exists({ userId })) return;
  const shows = await Show.find({
    userId,
    $or: [{ 'progress.totalEpisodesWatched': { $gt: 0 } }, { isWatched: true }],
  }).lean();
  if (!shows.length) return;
  await History.insertMany(
    shows.map((s) => {
      const episodes = s.mediaType === 'movie' ? 1 : s.progress?.totalEpisodesWatched || 0;
      return {
        userId,
        tmdbId: s.tmdbId,
        mediaType: s.mediaType || 'tv',
        episodes,
        minutes: episodes * (s.runtime || 0),
        watchedAt: s.lastWatchedAt || s.updatedAt || s.createdAt || new Date(),
        source: 'import',
      };
    })
  );
}

function rangeStart(range) {
  const now = new Date();
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}

/** Time watched in a range, plus minutes per month for the last 12 months. */
async function periodStats(userId, { range = 'year', type = 'all' } = {}) {
  await ensureBackfill(userId);
  const match = { userId: oid(userId), ...(type !== 'all' ? { mediaType: type } : {}) };
  const start = rangeStart(range);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11, 1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [result] = await History.aggregate([
    { $match: match },
    {
      $facet: {
        period: [
          ...(start ? [{ $match: { watchedAt: { $gte: start } } }] : []),
          {
            $group: {
              _id: null,
              minutes: { $sum: '$minutes' },
              episodes: { $sum: { $cond: [{ $eq: ['$mediaType', 'tv'] }, '$episodes', 0] } },
              movies: { $sum: { $cond: [{ $eq: ['$mediaType', 'movie'] }, 1, 0] } },
            },
          },
        ],
        monthly: [
          { $match: { watchedAt: { $gte: twelveMonthsAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$watchedAt' } },
              minutes: { $sum: '$minutes' },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const period = result.period[0] || { minutes: 0, episodes: 0, movies: 0 };
  delete period._id;
  return { range, type, period, monthly: result.monthly.map((m) => ({ month: m._id, minutes: m.minutes })) };
}

module.exports = {
  recordEpisodes,
  removeEpisodes,
  recordBatch,
  recordMovie,
  removeMovie,
  ensureBackfill,
  periodStats,
};
