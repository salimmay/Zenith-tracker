const axios = require('axios');
const config = require('../config');
const { HttpError } = require('./errors');

const http = axios.create({
  baseURL: 'https://api.themoviedb.org/3',
  timeout: 8000,
  params: { api_key: config.tmdbApiKey, language: 'en-US' },
});

// ─── Tiny TTL cache ───────────────────────────────────────────────────────────
// Per-instance and in-memory: good enough to collapse the burst of identical
// requests an Up Next screen makes, without adding infrastructure.
const MAX_ENTRIES = 2000;
const cache = new Map();
const inflight = new Map();

const TTL = {
  short: 10 * 60 * 1000, // search, lists
  show: 6 * 60 * 60 * 1000, // show/movie details (air dates change daily at most)
  season: 12 * 60 * 60 * 1000,
};

async function get(path, params = {}, ttl = TTL.show) {
  const key = path + JSON.stringify(params);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  // Deduplicate concurrent requests for the same resource.
  if (inflight.has(key)) return inflight.get(key);

  const promise = http
    .get(path, { params })
    .then((res) => {
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
      cache.set(key, { data: res.data, expiresAt: Date.now() + ttl });
      return res.data;
    })
    .catch((err) => {
      const status = err.response?.status;
      if (status === 404) throw new HttpError(404, 'Title not found on TMDB');
      throw new HttpError(502, 'TMDB is unavailable, try again shortly');
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

// Run `fn` over `items` with at most `limit` in flight — keeps us well under
// TMDB's rate limit when a user has hundreds of shows.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = err instanceof Error ? err : new Error(String(err));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const tmdb = {
  TTL,
  get,
  mapLimit,
  tv: (id, append) =>
    get(`/tv/${id}`, append ? { append_to_response: append } : {}, TTL.show),
  season: (id, n) => get(`/tv/${id}/season/${n}`, {}, TTL.season),
  movie: (id, append) =>
    get(`/movie/${id}`, append ? { append_to_response: append } : {}, TTL.show),
};

module.exports = tmdb;
