const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Show = require('../models/Show');
const User = require('../models/User');
const History = require('../models/History');
const tmdb = require('../lib/tmdb');
const progress = require('../lib/progress');
const library = require('../services/library');
const trakt = require('../services/trakt');
const history = require('../services/history');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { notFound, conflict } = require('../lib/errors');

const router = express.Router();
router.use(requireAuth);

const mediaType = z.enum(['tv', 'movie']);
const status = z.enum(Show.STATUSES);
const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'is not a valid id');
const position = z.object({ season: z.coerce.number().int().min(0), episode: z.coerce.number().int().min(0) });
const progressAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('watch') }),
  z.object({ type: z.literal('unwatch') }),
  z.object({ type: z.literal('set'), season: z.number().int().min(0), episode: z.number().int().min(0) }),
  z.object({ type: z.literal('complete_season'), season: z.number().int().min(0) }),
]);

async function settingsFor(userId) {
  const user = await User.findById(userId).select('settings');
  return { includeSpecials: Boolean(user?.settings?.includeSpecials) };
}

async function findOwned(req) {
  const show = await Show.findOne({ _id: req.valid.params.id, userId: req.userId });
  if (!show) throw notFound('That title is not in your library');
  return show;
}

// Trakt mirroring must never slow down or fail the response.
function mirror(userId, payload, remove = false) {
  trakt.pushChange(userId, payload, remove).catch((err) =>
    console.warn('[trakt] push failed:', err.message)
  );
}

// ─── Read ─────────────────────────────────────────────────────────────────────

router.get(
  '/',
  validate({ query: z.object({ status: status.optional(), mediaType: mediaType.optional() }) }),
  async (req, res) => {
    const filter = { userId: req.userId, ...req.valid.query };
    const items = await Show.find(filter).sort({ lastWatchedAt: -1, updatedAt: -1 }).lean();
    res.json({ items });
  }
);

router.get('/up-next', async (req, res) => {
  const settings = await settingsFor(req.userId);
  const shows = await Show.find({
    userId: req.userId,
    mediaType: 'tv',
    status: { $in: ['watching', 'waiting', 'completed'] },
  });

  const results = await tmdb.mapLimit(shows, 6, async (show) => {
    const info = await library.upNextFor(show, settings);
    // Keep stored status/metadata fresh: a caught-up show flips back to
    // "watching" the day a new episode airs, without any cron job.
    const changed = show.status !== info.status || show.tmdbStatus !== info.meta.tmdbStatus;
    if (changed) {
      show.status = info.status;
      Object.assign(show, info.meta);
      show.progress.totalEpisodesWatched = info.progress.totalEpisodesWatched;
      await show.save();
    }
    return { show: show.toObject(), ...info, meta: undefined };
  });

  const ok = results.filter((r) => !(r instanceof Error));
  const watching = ok
    .filter((r) => r.status === 'watching')
    .sort((a, b) => new Date(b.show.lastWatchedAt || 0) - new Date(a.show.lastWatchedAt || 0));
  const waiting = ok
    .filter((r) => r.status === 'waiting')
    .sort((a, b) => (a.nextToAir?.airDate || '9999').localeCompare(b.nextToAir?.airDate || '9999'));

  res.json({ watching, waiting, failed: results.length - ok.length });
});

// Library-wide totals and breakdowns (what's in the library right now).
async function libraryTotals(userId, typeMatch) {
  const [result] = await Show.aggregate([
    { $match: { userId, ...typeMatch } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              titles: { $sum: 1 },
              shows: { $sum: { $cond: [{ $eq: ['$mediaType', 'movie'] }, 0, 1] } },
              anime: { $sum: { $cond: ['$isAnime', 1, 0] } },
              movies: { $sum: { $cond: [{ $eq: ['$mediaType', 'movie'] }, 1, 0] } },
              moviesWatched: { $sum: { $cond: ['$isWatched', 1, 0] } },
              episodes: { $sum: { $ifNull: ['$progress.totalEpisodesWatched', 0] } },
              minutes: {
                $sum: {
                  $cond: [
                    { $eq: ['$mediaType', 'movie'] },
                    { $cond: ['$isWatched', '$runtime', 0] },
                    { $multiply: [{ $ifNull: ['$progress.totalEpisodesWatched', 0] }, '$runtime'] },
                  ],
                },
              },
            },
          },
        ],
        statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        genres: [
          { $unwind: '$genres' },
          { $group: { _id: '$genres', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ],
        topShows: [
          { $match: { mediaType: { $ne: 'movie' } } },
          { $addFields: { minutes: { $multiply: [{ $ifNull: ['$progress.totalEpisodesWatched', 0] }, '$runtime'] } } },
          { $sort: { minutes: -1 } },
          { $limit: 5 },
          { $project: { showName: 1, posterPath: 1, tmdbId: 1, minutes: 1, 'progress.totalEpisodesWatched': 1 } },
        ],
      },
    },
  ]);
  const totals = result.totals[0] || { titles: 0, shows: 0, anime: 0, movies: 0, moviesWatched: 0, episodes: 0, minutes: 0 };
  delete totals._id;
  return {
    ...totals,
    statuses: Object.fromEntries(result.statuses.map((s) => [s._id, s.count])),
    genres: result.genres.map((g) => ({ name: g._id, count: g.count })),
    topShows: result.topShows,
  };
}

router.get(
  '/stats',
  validate({
    query: z.object({
      range: z.enum(['month', 'year', 'all']).default('year'),
      type: z.enum(['all', 'tv', 'movie']).default('all'),
    }),
  }),
  async (req, res) => {
    const userId = new mongoose.Types.ObjectId(String(req.userId));
    const { range, type } = req.valid.query;
    const [totals, period] = await Promise.all([
      libraryTotals(userId, type === 'all' ? {} : { mediaType: type }),
      history.periodStats(req.userId, { range, type }),
    ]);
    // period/monthly come from the watch history: when things were actually watched.
    res.json({ ...totals, range, period: period.period, monthly: period.monthly });
  }
);

router.get(
  '/lookup/:mediaType/:tmdbId',
  validate({ params: z.object({ mediaType, tmdbId: z.coerce.number().int().positive() }) }),
  async (req, res) => {
    const item = await Show.findOne({ userId: req.userId, ...req.valid.params }).lean();
    res.json({ item });
  }
);

// ─── Write ────────────────────────────────────────────────────────────────────

router.post(
  '/',
  validate({
    body: z.object({
      tmdbId: z.number().int().positive(),
      mediaType,
      status: status.optional(),
    }),
  }),
  async (req, res) => {
    const { tmdbId, mediaType: type, status: requested } = req.valid.body;
    if (await Show.exists({ userId: req.userId, tmdbId, mediaType: type })) {
      throw conflict('Already in your library');
    }
    // Metadata comes from TMDB, never from the client.
    const meta = await library.fetchMeta(tmdbId, type);
    let initialStatus = requested || 'plan_to_watch';
    if (type === 'tv' && !progress.MANUAL_STATUSES.has(initialStatus)) {
      const settings = await settingsFor(req.userId);
      const order = progress.orderSeasons(meta.seasons, settings.includeSpecials);
      initialStatus = progress.resolveStatus(initialStatus, { season: 1, episode: 0 }, order, meta);
    }
    const isWatched = type === 'movie' && initialStatus === 'completed';
    const item = await Show.create({
      userId: req.userId,
      tmdbId,
      mediaType: type,
      ...library.storedFields(meta),
      status: initialStatus,
      manualStatus: Boolean(requested),
      isWatched,
      lastWatchedAt: isWatched ? new Date() : null,
    });
    if (isWatched) {
      await history.ensureBackfill(req.userId);
      await history.recordMovie(req.userId, item);
      mirror(req.userId, { movies: [{ ids: { tmdb: tmdbId } }] });
    }
    res.status(201).json({ item });
  }
);

router.patch(
  '/:id',
  validate({
    params: z.object({ id: objectId }),
    body: z.object({ status: status.optional(), rating: z.number().int().min(1).max(10).nullable().optional() }),
  }),
  async (req, res) => {
    const show = await findOwned(req);
    const { status: next, rating } = req.valid.body;
    if (rating !== undefined) show.rating = rating;
    if (next) {
      show.status = next;
      show.manualStatus = true;
      if (show.mediaType === 'movie') {
        const watched = next === 'completed';
        if (watched !== show.isWatched) {
          await history.ensureBackfill(req.userId);
          show.isWatched = watched;
          show.lastWatchedAt = watched ? new Date() : show.lastWatchedAt;
          await (watched ? history.recordMovie(req.userId, show) : history.removeMovie(req.userId, show.tmdbId));
          mirror(req.userId, { movies: [{ ids: { tmdb: show.tmdbId } }] }, !watched);
        }
      }
    }
    await show.save();
    res.json({ item: show });
  }
);

router.post(
  '/:id/progress',
  validate({ params: z.object({ id: objectId }), body: progressAction }),
  async (req, res) => {
    const show = await findOwned(req);
    const action = req.valid.body;
    // Before recording anything, so a pre-history library gets its import rows first.
    await history.ensureBackfill(req.userId);

    if (show.mediaType === 'movie') {
      const watched = action.type !== 'unwatch';
      const changed = watched !== show.isWatched;
      show.isWatched = watched;
      show.status = watched ? 'completed' : 'plan_to_watch';
      if (watched) show.lastWatchedAt = new Date();
      await show.save();
      if (changed) {
        await (watched ? history.recordMovie(req.userId, show) : history.removeMovie(req.userId, show.tmdbId));
        mirror(req.userId, { movies: [{ ids: { tmdb: show.tmdbId } }] }, !watched);
      }
      return res.json({ item: show });
    }

    const settings = await settingsFor(req.userId);
    const before = { season: show.progress.season, episode: show.progress.episode };
    const result = await library.applyTvAction(show, action, settings);
    Object.assign(show, result.meta);
    show.progress = result.progress;
    show.status = result.status;
    show.manualStatus = false;
    if (action.type !== 'unwatch') show.lastWatchedAt = new Date();
    await show.save();

    // Log and mirror exactly the episodes that changed.
    const { order } = result;
    const moved = progress.compare(result.progress, progress.normalize(before, order));
    if (moved > 0) {
      await history.recordEpisodes(req.userId, show, progress.episodesBetween(before, result.progress, order));
      const item = trakt.historyRange(show.tmdbId, before, result.progress, order);
      if (item) mirror(req.userId, { shows: [item] });
    } else if (moved < 0) {
      await history.removeEpisodes(req.userId, show.tmdbId, progress.episodesBetween(result.progress, before, order));
      const item = trakt.historyRange(show.tmdbId, result.progress, before, order);
      if (item) mirror(req.userId, { shows: [item] }, true);
    }

    res.json({ item: show });
  }
);

router.delete('/:id', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const show = await findOwned(req);
  await show.deleteOne();
  // A removed title shouldn't keep counting towards time watched.
  await History.deleteMany({ userId: req.userId, tmdbId: show.tmdbId, mediaType: show.mediaType });
  res.json({ message: 'Removed from your library' });
});

// ─── Guest → account migration ───────────────────────────────────────────────
// Everything a guest tracked on the device is merged in after sign-in.
// For titles already in the account, whichever side is further ahead wins.

router.post(
  '/sync-local',
  validate({
    body: z.object({
      items: z
        .array(
          z.object({
            tmdbId: z.number().int().positive(),
            mediaType,
            status: status.optional(),
            progress: position.optional(),
            isWatched: z.boolean().optional(),
            rating: z.number().int().min(1).max(10).nullable().optional(),
            lastWatchedAt: z.coerce.date().nullable().optional(),
          })
        )
        .max(2000),
      // The device's watch log, so a guest's stats come with them.
      history: z
        .array(
          z.object({
            tmdbId: z.number().int().positive(),
            mediaType,
            season: z.number().int().min(0).nullable().optional(),
            episode: z.number().int().min(0).nullable().optional(),
            episodes: z.number().int().min(1).default(1),
            minutes: z.number().min(0).default(0),
            watchedAt: z.coerce.date(),
          })
        )
        .max(20000)
        .default([]),
    }),
  }),
  async (req, res) => {
    const settings = await settingsFor(req.userId);
    const summary = { added: 0, merged: 0, unchanged: 0, failed: 0 };
    // Import the account's own pre-history library first, so the guest titles
    // added below aren't also counted by the backfill.
    await history.ensureBackfill(req.userId);

    await tmdb.mapLimit(req.valid.body.items, 6, async (local) => {
      try {
        const existing = await Show.findOne({ userId: req.userId, tmdbId: local.tmdbId, mediaType: local.mediaType });
        const meta = await library.fetchMeta(local.tmdbId, local.mediaType);

        if (local.mediaType === 'movie') {
          if (!existing) {
            await Show.create({
              userId: req.userId,
              tmdbId: local.tmdbId,
              mediaType: 'movie',
              ...library.storedFields(meta),
              status: local.status || (local.isWatched ? 'completed' : 'plan_to_watch'),
              isWatched: Boolean(local.isWatched),
              rating: local.rating ?? null,
              lastWatchedAt: local.lastWatchedAt ?? null,
            });
            summary.added++;
          } else if (local.isWatched && !existing.isWatched) {
            existing.isWatched = true;
            existing.status = 'completed';
            existing.lastWatchedAt = local.lastWatchedAt ?? new Date();
            await existing.save();
            summary.merged++;
          } else summary.unchanged++;
          return;
        }

        const order = progress.orderSeasons(meta.seasons, settings.includeSpecials);
        const localPos = progress.normalize(local.progress || { season: 1, episode: 0 }, order);
        const localStatus = progress.resolveStatus(local.status || 'watching', localPos, order, meta);
        const progressDoc = { ...localPos, totalEpisodesWatched: progress.countWatched(localPos, order) };

        if (!existing) {
          await Show.create({
            userId: req.userId,
            tmdbId: local.tmdbId,
            mediaType: 'tv',
            ...library.storedFields(meta),
            status: localStatus,
            progress: progressDoc,
            rating: local.rating ?? null,
            lastWatchedAt: local.lastWatchedAt ?? null,
          });
          summary.added++;
        } else if (progress.compare(localPos, progress.normalize(existing.progress, order)) > 0) {
          existing.progress = progressDoc;
          existing.status = localStatus;
          existing.lastWatchedAt = local.lastWatchedAt ?? new Date();
          await existing.save();
          summary.merged++;
        } else summary.unchanged++;
      } catch {
        summary.failed++;
      }
    });

    if (req.valid.body.history.length) {
      await History.insertMany(
        req.valid.body.history.map((h) => ({ ...h, userId: req.userId, source: 'guest' })),
        { ordered: false }
      );
    }

    res.json(summary);
  }
);

module.exports = router;
