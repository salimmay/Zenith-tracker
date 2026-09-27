const tmdb = require('../lib/tmdb');
const progress = require('../lib/progress');

const ANIMATION_GENRE = 16;

function detectAnime(data) {
  const animated = (data.genres || []).some((g) => g.id === ANIMATION_GENRE);
  const japanese =
    (data.origin_country || []).includes('JP') || data.original_language === 'ja';
  return animated && japanese;
}

function year(date) {
  const y = Number(String(date || '').slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : null;
}

/** Everything we need to know about a title, normalised across TV and film. */
async function fetchMeta(tmdbId, mediaType) {
  if (mediaType === 'movie') {
    const m = await tmdb.movie(tmdbId);
    return {
      showName: m.title,
      posterPath: m.poster_path,
      backdropPath: m.backdrop_path,
      isAnime: detectAnime(m),
      runtime: m.runtime || 0,
      genres: (m.genres || []).map((g) => g.name),
      year: year(m.release_date),
      totalEpisodes: 0,
      tmdbStatus: m.status || null,
    };
  }

  const t = await tmdb.tv(tmdbId);
  const last = t.last_episode_to_air;
  const next = t.next_episode_to_air;
  return {
    showName: t.name,
    posterPath: t.poster_path,
    backdropPath: t.backdrop_path,
    isAnime: detectAnime(t),
    runtime: t.episode_run_time?.[0] || last?.runtime || 0,
    genres: (t.genres || []).map((g) => g.name),
    year: year(t.first_air_date),
    totalEpisodes: t.number_of_episodes || 0,
    tmdbStatus: t.status || null,
    // not persisted — used by the progress engine
    seasons: t.seasons || [],
    lastAired: last ? { season: last.season_number, episode: last.episode_number } : null,
    nextToAir: next
      ? {
          season: next.season_number,
          episode: next.episode_number,
          name: next.name,
          airDate: next.air_date,
          stillPath: next.still_path,
        }
      : null,
  };
}

/** The subset of meta stored on the Show document. */
function storedFields(meta) {
  const { seasons, lastAired, nextToAir, ...fields } = meta;
  return fields;
}

async function episodeInfo(tmdbId, season, episode) {
  try {
    const s = await tmdb.season(tmdbId, season);
    const ep = (s.episodes || []).find((e) => e.episode_number === episode);
    if (!ep) return null;
    return {
      name: ep.name,
      overview: ep.overview,
      stillPath: ep.still_path,
      airDate: ep.air_date,
      runtime: ep.runtime,
    };
  } catch {
    return null;
  }
}

/**
 * Up Next card data for one TV entry: what to watch next, whether it has
 * aired, how many aired episodes are left, and the status it should have now.
 * `item` is a plain { tmdbId, status, progress } — works for DB docs and for
 * guest items sent by the app.
 */
async function upNextFor(item, { includeSpecials = false } = {}) {
  const meta = await fetchMeta(item.tmdbId, 'tv');
  const order = progress.orderSeasons(meta.seasons, includeSpecials);
  const position = progress.normalize(item.progress, order);
  const next = progress.nextEpisode(position, order);
  const status = progress.resolveStatus(item.status, position, order, meta);

  let nextEpisode = null;
  if (next) {
    const info = await episodeInfo(item.tmdbId, next.season, next.episode);
    nextEpisode = {
      ...next,
      ...info,
      aired: progress.isAired(next, meta.lastAired),
    };
  }

  const season = order.find((s) => s.number === (next?.season ?? position.season));
  return {
    status,
    progress: { ...position, totalEpisodesWatched: progress.countWatched(position, order) },
    next: nextEpisode,
    nextToAir: meta.nextToAir,
    remaining: progress.airedRemaining(position, order, meta.lastAired),
    totalEpisodes: progress.totalEpisodes(order),
    seasonEpisodeCount: season?.count ?? 0,
    meta: storedFields(meta),
  };
}

/** Apply a progress action to a TV entry. Returns { status, progress, meta, order }. */
async function applyTvAction(item, action, { includeSpecials = false } = {}) {
  const meta = await fetchMeta(item.tmdbId, 'tv');
  const result = progress.applyAction(item, action, { ...meta, includeSpecials });
  return { ...result, meta: storedFields(meta), order: progress.orderSeasons(meta.seasons, includeSpecials) };
}

module.exports = { fetchMeta, storedFields, episodeInfo, upNextFor, applyTvAction };
