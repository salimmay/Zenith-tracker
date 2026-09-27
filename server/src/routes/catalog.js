// Public TMDB proxy + stateless progress engine.
// Public so guests (no account yet) get the same search, details and Up Next
// logic as signed-in users; the TMDB key never ships inside the app.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const tmdb = require('../lib/tmdb');
const progress = require('../lib/progress');
const library = require('../services/library');
const { upcomingEpisodes } = require('./calendar');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 240,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Slow down a little' },
  })
);

const id = z.coerce.number().int().positive();
const page = z.coerce.number().int().min(1).max(500).default(1);

// Keep payloads small: the app only needs these fields for grids and rows.
function slim(item, fallbackType) {
  const mediaType = item.media_type || fallbackType;
  return {
    tmdbId: item.id,
    mediaType,
    title: item.name || item.title,
    posterPath: item.poster_path,
    backdropPath: item.backdrop_path,
    overview: item.overview,
    year: Number(String(item.first_air_date || item.release_date || '').slice(0, 4)) || null,
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
    isAnime: (item.genre_ids || []).includes(16) && (item.origin_country || []).includes('JP'),
  };
}

function page_(data, fallbackType) {
  return {
    page: data.page,
    totalPages: Math.min(data.total_pages || 1, 500),
    results: (data.results || [])
      .filter((r) => (r.media_type || fallbackType) !== 'person')
      .map((r) => slim(r, fallbackType)),
  };
}

const LISTS = {
  trending: { path: '/trending/all/week' }, // shows and movies, each tagged by TMDB
  'trending-tv': { path: '/trending/tv/week', type: 'tv' },
  'trending-movies': { path: '/trending/movie/week', type: 'movie' },
  'popular-tv': { path: '/tv/popular', type: 'tv' },
  'top-tv': { path: '/tv/top_rated', type: 'tv' },
  'airing-today': { path: '/tv/airing_today', type: 'tv' },
  'popular-movies': { path: '/movie/popular', type: 'movie' },
  'now-playing': { path: '/movie/now_playing', type: 'movie' },
  anime: {
    path: '/discover/tv',
    type: 'tv',
    params: { with_genres: '16', with_origin_country: 'JP', sort_by: 'popularity.desc' },
  },
};

router.get(
  '/lists/:list',
  validate({ params: z.object({ list: z.enum(Object.keys(LISTS)) }), query: z.object({ page }) }),
  async (req, res) => {
    const list = LISTS[req.valid.params.list];
    const data = await tmdb.get(list.path, { ...list.params, page: req.valid.query.page }, tmdb.TTL.short);
    res.json(page_(data, list.type));
  }
);

router.get(
  '/search',
  validate({
    query: z.object({
      q: z.string().trim().min(1).max(100),
      type: z.enum(['multi', 'tv', 'movie']).default('multi'),
      page,
    }),
  }),
  async (req, res) => {
    const { q, type, page: p } = req.valid.query;
    const data = await tmdb.get(`/search/${type}`, { query: q, page: p, include_adult: false }, tmdb.TTL.short);
    res.json(page_(data, type === 'multi' ? undefined : type));
  }
);

router.get('/tv/:id', validate({ params: z.object({ id }) }), async (req, res) => {
  const t = await tmdb.tv(req.valid.params.id, 'recommendations,credits,videos');
  res.json({
    ...slim(t, 'tv'),
    genres: (t.genres || []).map((g) => g.name),
    isAnime: (t.genres || []).some((g) => g.id === 16) && (t.origin_country || []).includes('JP'),
    tagline: t.tagline,
    status: t.status,
    networks: (t.networks || []).map((n) => n.name),
    runtime: t.episode_run_time?.[0] || t.last_episode_to_air?.runtime || null,
    numberOfSeasons: t.number_of_seasons,
    numberOfEpisodes: t.number_of_episodes,
    seasons: (t.seasons || []).map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
      airDate: s.air_date,
      posterPath: s.poster_path,
    })),
    lastAired: t.last_episode_to_air
      ? { season: t.last_episode_to_air.season_number, episode: t.last_episode_to_air.episode_number }
      : null,
    nextToAir: t.next_episode_to_air
      ? {
          season: t.next_episode_to_air.season_number,
          episode: t.next_episode_to_air.episode_number,
          name: t.next_episode_to_air.name,
          airDate: t.next_episode_to_air.air_date,
        }
      : null,
    cast: (t.credits?.cast || []).slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
    })),
    trailerKey: (t.videos?.results || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key || null,
    recommendations: (t.recommendations?.results || []).slice(0, 12).map((r) => slim(r, 'tv')),
  });
});

router.get(
  '/tv/:id/season/:season',
  validate({ params: z.object({ id, season: z.coerce.number().int().min(0) }) }),
  async (req, res) => {
    const s = await tmdb.season(req.valid.params.id, req.valid.params.season);
    res.json({
      seasonNumber: s.season_number,
      name: s.name,
      overview: s.overview,
      episodes: (s.episodes || []).map((e) => ({
        episodeNumber: e.episode_number,
        name: e.name,
        overview: e.overview,
        airDate: e.air_date,
        runtime: e.runtime,
        stillPath: e.still_path,
        rating: e.vote_average ? Math.round(e.vote_average * 10) / 10 : null,
      })),
    });
  }
);

router.get('/movie/:id', validate({ params: z.object({ id }) }), async (req, res) => {
  const m = await tmdb.movie(req.valid.params.id, 'recommendations,credits,videos');
  res.json({
    ...slim(m, 'movie'),
    genres: (m.genres || []).map((g) => g.name),
    tagline: m.tagline,
    status: m.status,
    runtime: m.runtime || null,
    releaseDate: m.release_date,
    cast: (m.credits?.cast || []).slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
    })),
    trailerKey: (m.videos?.results || []).find((v) => v.site === 'YouTube' && v.type === 'Trailer')?.key || null,
    recommendations: (m.recommendations?.results || []).slice(0, 12).map((r) => slim(r, 'movie')),
  });
});

// ─── Guest progress (same engine the account routes use) ─────────────────────

const guestItem = z.object({
  tmdbId: z.number().int().positive(),
  status: z.string().default('watching'),
  progress: z.object({ season: z.number().int().min(0), episode: z.number().int().min(0) }),
});

router.post(
  '/progress/up-next',
  validate({
    body: z.object({ items: z.array(guestItem).max(300), includeSpecials: z.boolean().default(false) }),
  }),
  async (req, res) => {
    const { items, includeSpecials } = req.valid.body;
    const results = await tmdb.mapLimit(items, 6, (item) => library.upNextFor(item, { includeSpecials }));
    res.json({
      items: results.map((r, i) =>
        r instanceof Error ? { tmdbId: items[i].tmdbId, error: r.message } : { tmdbId: items[i].tmdbId, ...r }
      ),
    });
  }
);

router.post(
  '/progress/apply',
  validate({
    body: z.object({
      item: guestItem,
      action: z.discriminatedUnion('type', [
        z.object({ type: z.literal('watch') }),
        z.object({ type: z.literal('unwatch') }),
        z.object({ type: z.literal('set'), season: z.number().int().min(0), episode: z.number().int().min(0) }),
        z.object({ type: z.literal('complete_season'), season: z.number().int().min(0) }),
      ]),
      includeSpecials: z.boolean().default(false),
    }),
  }),
  async (req, res) => {
    const { item, action, includeSpecials } = req.valid.body;
    const result = await library.applyTvAction(item, action, { includeSpecials });
    res.json({ status: result.status, progress: result.progress, meta: result.meta });
  }
);

router.post(
  '/calendar',
  validate({
    body: z.object({
      items: z
        .array(
          z.object({
            tmdbId: z.number().int().positive(),
            showName: z.string().optional(),
            posterPath: z.string().nullable().optional(),
            status: z.string().optional(),
          })
        )
        .max(300),
      days: z.number().int().min(1).max(120).default(45),
    }),
  }),
  async (req, res) => {
    res.json(await upcomingEpisodes(req.valid.body.items, req.valid.body.days));
  }
);

// Metadata for a guest adding a title (so the app stores the same fields).
router.get(
  '/meta/:mediaType/:id',
  validate({ params: z.object({ mediaType: z.enum(['tv', 'movie']), id }) }),
  async (req, res) => {
    const meta = await library.fetchMeta(req.valid.params.id, req.valid.params.mediaType);
    let status = null;
    if (req.valid.params.mediaType === 'tv') {
      const order = progress.orderSeasons(meta.seasons);
      status = progress.resolveStatus('watching', { season: 1, episode: 0 }, order, meta);
    }
    res.json({ meta: library.storedFields(meta), suggestedStatus: status });
  }
);

module.exports = router;
