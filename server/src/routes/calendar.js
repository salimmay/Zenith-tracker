const express = require('express');
const { z } = require('zod');
const Show = require('../models/Show');
const tmdb = require('../lib/tmdb');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

/**
 * Episodes airing in the next `days` days for the given shows — every episode
 * in the window, not just the single "next episode", so a weekly show appears
 * every week. `shows` are plain { tmdbId, showName, posterPath, status, _id? }.
 */
async function upcomingEpisodes(shows, days) {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const perShow = await tmdb.mapLimit(shows, 6, async (show) => {
    const details = await tmdb.tv(show.tmdbId);
    const next = details.next_episode_to_air;
    if (!next || next.air_date > until) return [];
    const season = await tmdb.season(show.tmdbId, next.season_number);
    return (season.episodes || [])
      .filter((e) => e.air_date && e.air_date >= today && e.air_date <= until)
      .map((e) => ({
        showId: show._id,
        tmdbId: show.tmdbId,
        showName: show.showName || details.name,
        posterPath: show.posterPath ?? details.poster_path,
        status: show.status,
        season: e.season_number,
        episode: e.episode_number,
        name: e.name,
        airDate: e.air_date,
        stillPath: e.still_path,
        isPremiere: e.episode_number === 1,
        isFinale: e.episode_number === season.episodes.length,
      }));
  });

  const episodes = perShow
    .filter((r) => Array.isArray(r))
    .flat()
    .sort((a, b) => a.airDate.localeCompare(b.airDate) || a.showName.localeCompare(b.showName));

  return { from: today, until, episodes };
}

const FOLLOWED = ['watching', 'waiting', 'plan_to_watch', 'completed'];

router.get(
  '/',
  requireAuth,
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(120).default(45) }) }),
  async (req, res) => {
    const shows = await Show.find({ userId: req.userId, mediaType: 'tv', status: { $in: FOLLOWED } })
      .select('tmdbId showName posterPath status')
      .lean();
    res.json(await upcomingEpisodes(shows, req.valid.query.days));
  }
);

module.exports = router;
module.exports.upcomingEpisodes = upcomingEpisodes;
module.exports.FOLLOWED = FOLLOWED;
