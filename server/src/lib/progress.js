/**
 * Progress engine — pure functions, no I/O.
 *
 * A position `{ season, episode }` is the LAST WATCHED episode. `episode: 0`
 * means nothing watched in that season yet. The first API version also wrote
 * `{ season: N + 1, episode: 0 }` after finishing season N, and sometimes a
 * season that doesn't exist on TMDB ("phantom season"); `normalize` folds all
 * of those into one canonical form, so every other function can trust it.
 *
 * `seasons` is TMDB's `seasons` array: [{ season_number, episode_count }].
 */

const MANUAL_STATUSES = new Set(['plan_to_watch', 'paused', 'dropped']);
const ENDED_TMDB_STATUSES = new Set(['Ended', 'Canceled']);

function compare(a, b) {
  if (a.season !== b.season) return a.season - b.season;
  return a.episode - b.episode;
}

/** Seasons in watch order, without empty seasons, specials only if opted in. */
function orderSeasons(seasons = [], includeSpecials = false) {
  return seasons
    .filter((s) => s.episode_count > 0 && (includeSpecials || s.season_number > 0))
    .map((s) => ({ number: s.season_number, count: s.episode_count }))
    .sort((a, b) => a.number - b.number);
}

function normalize(pos, order) {
  const season = Number(pos?.season) || 0;
  const episode = Math.max(0, Number(pos?.episode) || 0);
  if (order.length === 0) return { season: season || 1, episode };

  let idx = order.findIndex((s) => s.number === season);
  if (idx === -1) {
    const last = order[order.length - 1];
    if (season > last.number) return { season: last.number, episode: last.count }; // phantom
    idx = order.findIndex((s) => s.number > season);
    return idx > 0
      ? { season: order[idx - 1].number, episode: order[idx - 1].count }
      : { season: order[0].number, episode: 0 };
  }

  const clamped = Math.min(episode, order[idx].count);
  if (clamped === 0 && idx > 0) {
    // "start of season N" is the same place as "end of season N-1"
    return { season: order[idx - 1].number, episode: order[idx - 1].count };
  }
  return { season, episode: clamped };
}

/** The next episode to watch, or null when the known seasons are exhausted. */
function nextEpisode(pos, order) {
  const p = normalize(pos, order);
  const idx = order.findIndex((s) => s.number === p.season);
  if (idx === -1) return null;
  if (p.episode < order[idx].count) return { season: p.season, episode: p.episode + 1 };
  const following = order[idx + 1];
  return following ? { season: following.number, episode: 1 } : null;
}

function previousPosition(pos, order) {
  const p = normalize(pos, order);
  if (p.episode > 1) return { season: p.season, episode: p.episode - 1 };
  const idx = order.findIndex((s) => s.number === p.season);
  if (p.episode === 1 && idx > 0) {
    return { season: order[idx - 1].number, episode: order[idx - 1].count };
  }
  return { season: p.season, episode: 0 };
}

function countWatched(pos, order) {
  const p = normalize(pos, order);
  let total = 0;
  for (const s of order) {
    if (s.number === p.season) return total + p.episode;
    total += s.count;
  }
  return total;
}

/**
 * Episodes after `from` (exclusive, may be null) up to `to` (inclusive), in
 * watch order. Used to log history and mirror to Trakt exactly what changed.
 */
function episodesBetween(from, to, order) {
  const start = from ? normalize(from, order) : null;
  const end = normalize(to, order);
  const out = [];
  for (const s of order) {
    for (let e = 1; e <= s.count; e++) {
      const pos = { season: s.number, episode: e };
      if (compare(pos, end) > 0) return out;
      if (!start || compare(pos, start) > 0) out.push(pos);
    }
  }
  return out;
}

function totalEpisodes(order) {
  return order.reduce((sum, s) => sum + s.count, 0);
}

function isAired(ep, lastAired) {
  return Boolean(ep && lastAired && compare(ep, lastAired) <= 0);
}

/** Aired episodes the user hasn't watched yet. */
function airedRemaining(pos, order, lastAired) {
  if (!lastAired) return 0;
  return Math.max(0, countWatched(lastAired, order) - countWatched(pos, order));
}

/**
 * Derive the status from where the user is and what has aired.
 * plan_to_watch / paused / dropped are user choices and are never overridden.
 */
function resolveStatus(current, pos, order, { lastAired, tmdbStatus } = {}) {
  if (MANUAL_STATUSES.has(current)) return current;
  const next = nextEpisode(pos, order);
  if (next && isAired(next, lastAired)) return 'watching';
  const ended = ENDED_TMDB_STATUSES.has(tmdbStatus);
  if (ended) return 'completed';
  // Nothing aired left to watch (or not premiered yet), but the show is still going.
  return 'waiting';
}

/**
 * Apply a user action to a TV show and return the new state.
 * Throws an Error with `.status = 400` for impossible actions.
 *
 * action: { type: 'watch' }
 *         { type: 'unwatch' }
 *         { type: 'set', season, episode }
 *         { type: 'complete_season', season }
 */
function applyAction(state, action, meta) {
  const order = orderSeasons(meta.seasons, meta.includeSpecials);
  const current = normalize(state.progress, order);
  let position;

  switch (action.type) {
    case 'watch': {
      const next = nextEpisode(current, order);
      if (!next) throw userError('You are all caught up on this show.');
      if (!isAired(next, meta.lastAired)) throw userError("That episode hasn't aired yet.");
      position = next;
      break;
    }
    case 'unwatch':
      position = previousPosition(current, order);
      break;
    case 'set':
      position = normalize({ season: action.season, episode: action.episode }, order);
      break;
    case 'complete_season': {
      const target = order.find((s) => s.number === Number(action.season));
      if (!target) throw userError('Unknown season.');
      const end = { season: target.number, episode: target.count };
      position = compare(end, current) > 0 ? end : current;
      break;
    }
    default:
      throw userError('Unknown action.');
  }

  // Watching something resumes a paused/dropped/planned show.
  const moving = action.type !== 'unwatch';
  const baseStatus = moving && MANUAL_STATUSES.has(state.status) ? 'watching' : state.status;

  return {
    progress: {
      season: position.season,
      episode: position.episode,
      totalEpisodesWatched: countWatched(position, order),
    },
    status: resolveStatus(baseStatus, position, order, meta),
  };
}

function userError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

module.exports = {
  MANUAL_STATUSES,
  compare,
  orderSeasons,
  normalize,
  nextEpisode,
  previousPosition,
  countWatched,
  episodesBetween,
  totalEpisodes,
  isAired,
  airedRemaining,
  resolveStatus,
  applyAction,
};
