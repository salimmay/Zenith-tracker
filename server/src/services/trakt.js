const axios = require('axios');
const config = require('../config');
const User = require('../models/User');
const Show = require('../models/Show');
const tmdb = require('../lib/tmdb');
const progress = require('../lib/progress');
const library = require('./library');
const history = require('./history');
const { HttpError } = require('../lib/errors');

const api = axios.create({ baseURL: 'https://api.trakt.tv', timeout: 15000 });
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;
const TOKEN_FIELDS = '+trakt.accessToken +trakt.refreshToken +trakt.expiresAt';

function ensureEnabled() {
  if (!config.trakt.enabled) {
    throw new HttpError(503, 'Trakt is not configured on this server');
  }
}

function baseHeaders(accessToken) {
  return {
    'trakt-api-version': '2',
    'trakt-api-key': config.trakt.clientId,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function saveTokens(userId, data) {
  const expiresAt = new Date((data.created_at + data.expires_in) * 1000);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'trakt.accessToken': data.access_token,
        'trakt.refreshToken': data.refresh_token,
        'trakt.expiresAt': expiresAt,
      },
    }
  );
  return data.access_token;
}

async function disconnectedError(userId) {
  await User.updateOne({ _id: userId }, { $set: { trakt: {} } });
  return new HttpError(401, 'Trakt access was revoked, connect again', { traktDisconnected: true });
}

/** A valid access token for the user, refreshing it when close to expiry. */
async function accessTokenFor(userId) {
  ensureEnabled();
  const user = await User.findById(userId).select(TOKEN_FIELDS);
  if (!user?.trakt?.accessToken) {
    throw new HttpError(400, 'Connect your Trakt account first', { traktDisconnected: true });
  }
  const expiresAt = user.trakt.expiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > REFRESH_MARGIN_MS) return user.trakt.accessToken;

  try {
    const { data } = await api.post('/oauth/token', {
      refresh_token: user.trakt.refreshToken,
      client_id: config.trakt.clientId,
      client_secret: config.trakt.clientSecret,
      redirect_uri: config.trakt.redirectUri,
      grant_type: 'refresh_token',
    });
    return saveTokens(userId, data);
  } catch {
    throw await disconnectedError(userId);
  }
}

// ─── Device-code connect flow ────────────────────────────────────────────────
// Suits a phone app: no redirect back into the app. The app shows a short code,
// the user enters it on trakt.tv/activate, and the app polls until it's done.

async function startDeviceAuth() {
  ensureEnabled();
  const { data } = await api.post('/oauth/device/code', { client_id: config.trakt.clientId });
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUrl: data.verification_url,
    interval: data.interval,
    expiresIn: data.expires_in,
  };
}

const POLL_STATES = { 400: 'pending', 404: 'invalid', 409: 'used', 410: 'expired', 418: 'denied', 429: 'slow_down' };

async function pollDeviceAuth(userId, deviceCode) {
  ensureEnabled();
  let tokens;
  try {
    ({ data: tokens } = await api.post('/oauth/device/token', {
      code: deviceCode,
      client_id: config.trakt.clientId,
      client_secret: config.trakt.clientSecret,
    }));
  } catch (err) {
    const state = POLL_STATES[err.response?.status];
    if (state) return { state };
    throw new HttpError(502, 'Could not reach Trakt');
  }

  await saveTokens(userId, tokens);
  let username = null;
  try {
    const { data } = await api.get('/users/settings', { headers: baseHeaders(tokens.access_token) });
    username = data.user?.username ?? null;
  } catch {
    // Username is cosmetic — the connection still succeeded.
  }
  await User.updateOne(
    { _id: userId },
    { $set: { 'trakt.username': username, 'trakt.connectedAt': new Date() } }
  );
  return { state: 'connected', username };
}

async function disconnect(userId) {
  const user = await User.findById(userId).select(TOKEN_FIELDS);
  if (user?.trakt?.accessToken && config.trakt.enabled) {
    await api
      .post('/oauth/revoke', {
        token: user.trakt.accessToken,
        client_id: config.trakt.clientId,
        client_secret: config.trakt.clientSecret,
      })
      .catch(() => {}); // best effort — we forget the tokens either way
  }
  await User.updateOne({ _id: userId }, { $set: { trakt: {} } });
}

// ─── Push (Zenith → Trakt) ───────────────────────────────────────────────────

/**
 * The episodes after `from` up to and including `to`, in Trakt's history
 * format. Sending only the difference matters: every POST to /sync/history
 * records a new play, so re-sending watched episodes would count them twice.
 * `from` may be null (nothing watched).
 */
function historyRange(tmdbId, from, to, order, watchedAt) {
  const bySeason = new Map();
  for (const ep of progress.episodesBetween(from, to, order)) {
    if (!bySeason.has(ep.season)) bySeason.set(ep.season, []);
    bySeason.get(ep.season).push({ number: ep.episode, ...(watchedAt ? { watched_at: watchedAt } : {}) });
  }
  const seasons = [...bySeason].map(([number, episodes]) => ({ number, episodes }));
  return seasons.length ? { ids: { tmdb: tmdbId }, seasons } : null;
}

async function postHistory(userId, token, body, method = 'history') {
  try {
    await api.post(`/sync/${method}`, body, { headers: baseHeaders(token) });
  } catch (err) {
    if (err.response?.status === 401) throw await disconnectedError(userId);
    throw err;
  }
}

/**
 * Mirror a change to Trakt. `payload` is { shows?, movies? } in Trakt's sync
 * format. Fire-and-forget from the routes: a Trakt outage must never fail a
 * checkmark in the app. No-op for users who haven't connected Trakt.
 */
async function pushChange(userId, payload, remove = false) {
  if (!config.trakt.enabled) return;
  const user = await User.findById(userId).select('trakt.connectedAt');
  if (!user?.trakt?.connectedAt) return;
  const token = await accessTokenFor(userId);
  await postHistory(userId, token, payload, remove ? 'history/remove' : 'history');
}

// ─── Full two-way sync ───────────────────────────────────────────────────────

function furthestWatched(traktShow, includeSpecials) {
  let best = null;
  for (const season of traktShow.seasons || []) {
    if (!includeSpecials && season.number === 0) continue;
    for (const ep of season.episodes || []) {
      const pos = { season: season.number, episode: ep.number };
      if (!best || progress.compare(pos, best) > 0) best = pos;
    }
  }
  return best;
}

/**
 * Pull: anything further ahead on Trakt moves Zenith forward; titles only on
 * Trakt are added. Push: anything further ahead in Zenith is sent to Trakt.
 * Progress never moves backwards in either direction.
 */
async function fullSync(userId) {
  const token = await accessTokenFor(userId);
  const user = await User.findById(userId);
  const includeSpecials = Boolean(user.settings?.includeSpecials);
  const headers = { headers: baseHeaders(token) };

  let watchedShows;
  let watchedMovies;
  try {
    [{ data: watchedShows }, { data: watchedMovies }] = await Promise.all([
      api.get('/sync/watched/shows', headers),
      api.get('/sync/watched/movies', headers),
    ]);
  } catch (err) {
    if (err.response?.status === 401) throw await disconnectedError(userId);
    throw new HttpError(502, 'Could not reach Trakt');
  }

  await history.ensureBackfill(userId); // before adding titles, so they aren't counted twice
  const library_ = await Show.find({ userId });
  const byKey = new Map(library_.map((s) => [`${s.mediaType}:${s.tmdbId}`, s]));
  const summary = { added: 0, updated: 0, pushed: 0, failed: 0 };
  const pushShows = [];
  const pushMovies = [];
  const seenTv = new Set();

  // Shows
  await tmdb.mapLimit(watchedShows, 6, async (entry) => {
    const tmdbId = entry.show?.ids?.tmdb;
    const traktPos = tmdbId && furthestWatched(entry, includeSpecials);
    if (!traktPos) return;
    seenTv.add(tmdbId);
    try {
      const meta = await library.fetchMeta(tmdbId, 'tv');
      const order = progress.orderSeasons(meta.seasons, includeSpecials);
      const existing = byKey.get(`tv:${tmdbId}`);
      const traktNorm = progress.normalize(traktPos, order);

      const watchedAt = entry.last_watched_at ? new Date(entry.last_watched_at) : new Date();
      if (!existing) {
        const created = await Show.create({
          userId,
          tmdbId,
          mediaType: 'tv',
          ...library.storedFields(meta),
          status: progress.resolveStatus('watching', traktNorm, order, meta),
          progress: { ...traktNorm, totalEpisodesWatched: progress.countWatched(traktNorm, order) },
          lastWatchedAt: watchedAt,
        });
        await history.recordBatch(userId, created, created.progress.totalEpisodesWatched, { source: 'trakt', watchedAt });
        summary.added++;
        return;
      }

      const ours = progress.normalize(existing.progress, order);
      const cmp = progress.compare(traktNorm, ours);
      if (cmp > 0) {
        const gained = progress.countWatched(traktNorm, order) - progress.countWatched(ours, order);
        await history.recordBatch(userId, existing, gained, { source: 'trakt', watchedAt });
        existing.progress = { ...traktNorm, totalEpisodesWatched: progress.countWatched(traktNorm, order) };
        existing.status = progress.resolveStatus(existing.status, traktNorm, order, meta);
        existing.lastWatchedAt = entry.last_watched_at ? new Date(entry.last_watched_at) : existing.lastWatchedAt;
        Object.assign(existing, library.storedFields(meta));
        await existing.save();
        summary.updated++;
      } else if (cmp < 0) {
        const item = historyRange(tmdbId, traktNorm, ours, order, (existing.lastWatchedAt || new Date()).toISOString());
        if (item) pushShows.push(item);
      }
    } catch {
      summary.failed++;
    }
  });

  // Shows only in Zenith with progress → push them too.
  const localOnly = library_.filter(
    (s) => s.mediaType === 'tv' && !seenTv.has(s.tmdbId) && (s.progress?.totalEpisodesWatched > 0 || s.progress?.episode > 0)
  );
  await tmdb.mapLimit(localOnly, 6, async (s) => {
    try {
      const meta = await library.fetchMeta(s.tmdbId, 'tv');
      const order = progress.orderSeasons(meta.seasons, includeSpecials);
      const item = historyRange(s.tmdbId, null, s.progress, order, (s.lastWatchedAt || new Date()).toISOString());
      if (item) pushShows.push(item);
    } catch {
      summary.failed++;
    }
  });

  // Movies
  const traktMovieIds = new Set();
  await tmdb.mapLimit(watchedMovies, 6, async (entry) => {
    const tmdbId = entry.movie?.ids?.tmdb;
    if (!tmdbId) return;
    traktMovieIds.add(tmdbId);
    const existing = byKey.get(`movie:${tmdbId}`);
    const watchedAt = entry.last_watched_at ? new Date(entry.last_watched_at) : new Date();
    try {
      if (!existing) {
        const meta = await library.fetchMeta(tmdbId, 'movie');
        const created = await Show.create({
          userId,
          tmdbId,
          mediaType: 'movie',
          ...library.storedFields(meta),
          status: 'completed',
          isWatched: true,
          lastWatchedAt: watchedAt,
        });
        await history.recordBatch(userId, created, 1, { source: 'trakt', watchedAt });
        summary.added++;
      } else if (!existing.isWatched) {
        existing.isWatched = true;
        existing.status = 'completed';
        existing.lastWatchedAt = watchedAt;
        await existing.save();
        await history.recordBatch(userId, existing, 1, { source: 'trakt', watchedAt });
        summary.updated++;
      }
    } catch {
      summary.failed++;
    }
  });
  for (const s of library_) {
    if (s.mediaType === 'movie' && s.isWatched && !traktMovieIds.has(s.tmdbId)) {
      pushMovies.push({ ids: { tmdb: s.tmdbId }, watched_at: (s.lastWatchedAt || new Date()).toISOString() });
    }
  }

  // Push in small batches — Trakt rate-limits writes to roughly one per second.
  const CHUNK = 25;
  for (let i = 0; i < Math.max(pushShows.length, pushMovies.length); i += CHUNK) {
    const body = { shows: pushShows.slice(i, i + CHUNK), movies: pushMovies.slice(i, i + CHUNK) };
    await postHistory(userId, token, body);
    summary.pushed += body.shows.length + body.movies.length;
    if (i + CHUNK < Math.max(pushShows.length, pushMovies.length)) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  await User.updateOne({ _id: userId }, { $set: { 'trakt.lastSyncedAt': new Date() } });
  return summary;
}

module.exports = { startDeviceAuth, pollDeviceAuth, disconnect, pushChange, fullSync, historyRange };
