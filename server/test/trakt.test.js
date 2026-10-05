// End-to-end Trakt sync against a fake Trakt API that behaves like the real one:
// every POST to /sync/history adds a play (so duplicates are visible), refresh
// tokens are single-use, and writes can be rate-limited.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { MongoMemoryServer } = require('mongodb-memory-server');

// ─── Fake Trakt ───────────────────────────────────────────────────────────────
const fake = {
  approved: false,
  refreshes: 0,
  refreshMode: 'ok', // 'ok' | 'invalid' | 'down'
  rateLimitNext: 0, // how many upcoming history writes answer 429
  tokenSeq: 0,
  refreshToken: null,
  shows: new Map(), // tmdbId → Map("s:e" → plays)
  movies: new Map(), // tmdbId → plays
  requests: [],
};

function issueTokens() {
  fake.tokenSeq++;
  fake.refreshToken = `refresh-${fake.tokenSeq}`;
  return {
    access_token: `access-${fake.tokenSeq}`,
    refresh_token: fake.refreshToken,
    created_at: Math.floor(Date.now() / 1000),
    expires_in: 24 * 3600, // Trakt access tokens now last 24 hours
  };
}

const plays = (tmdbId, s, e) => fake.shows.get(tmdbId)?.get(`${s}:${e}`) ?? 0;
const allPlays = () => [...fake.shows.values()].flatMap((m) => [...m.values()]).concat([...fake.movies.values()]);

const traktApp = express();
traktApp.use(express.json());
traktApp.use((req, _res, next) => {
  fake.requests.push({ path: req.path, ua: req.get('user-agent'), key: req.get('trakt-api-key') });
  next();
});
traktApp.post('/oauth/device/code', (_req, res) =>
  res.json({ device_code: 'dev-1', user_code: 'ABCD1234', verification_url: 'https://trakt.tv/activate', interval: 1, expires_in: 600 })
);
traktApp.post('/oauth/device/token', (req, res) => {
  if (req.body.code !== 'dev-1') return res.status(404).end();
  if (!fake.approved) return res.status(400).end();
  res.json(issueTokens());
});
traktApp.post('/oauth/token', async (req, res) => {
  fake.refreshes++;
  await new Promise((r) => setTimeout(r, 30)); // a real round trip, so concurrent callers overlap
  if (fake.refreshMode === 'down') return res.status(503).end();
  if (fake.refreshMode === 'invalid' || req.body.refresh_token !== fake.refreshToken) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  res.json(issueTokens());
});
traktApp.post('/oauth/revoke', (_req, res) => res.json({}));
traktApp.get('/users/settings', (_req, res) => res.json({ user: { username: 'tester' } }));
traktApp.get('/sync/watched/shows', (_req, res) => {
  res.json(
    [...fake.shows].map(([tmdbId, eps]) => {
      const seasons = new Map();
      for (const key of eps.keys()) {
        const [s, e] = key.split(':').map(Number);
        if (!seasons.has(s)) seasons.set(s, []);
        seasons.get(s).push({ number: e, plays: eps.get(key) });
      }
      return {
        last_watched_at: new Date().toISOString(),
        show: { ids: { tmdb: tmdbId } },
        seasons: [...seasons].map(([number, episodes]) => ({ number, episodes })),
      };
    })
  );
});
traktApp.get('/sync/watched/movies', (_req, res) =>
  res.json([...fake.movies].map(([tmdbId, n]) => ({ plays: n, last_watched_at: new Date().toISOString(), movie: { ids: { tmdb: tmdbId } } })))
);
function applyHistory(body, delta) {
  for (const show of body.shows || []) {
    const id = show.ids.tmdb;
    if (!fake.shows.has(id)) fake.shows.set(id, new Map());
    const eps = fake.shows.get(id);
    for (const season of show.seasons || []) {
      for (const ep of season.episodes || []) {
        const key = `${season.number}:${ep.number}`;
        if (delta > 0) eps.set(key, (eps.get(key) ?? 0) + 1);
        else eps.delete(key); // Trakt removes every play of that episode
      }
    }
  }
  for (const movie of body.movies || []) {
    const id = movie.ids.tmdb;
    if (delta > 0) fake.movies.set(id, (fake.movies.get(id) ?? 0) + 1);
    else fake.movies.delete(id);
  }
}
traktApp.post('/sync/history', (req, res) => {
  if (fake.rateLimitNext > 0) {
    fake.rateLimitNext--;
    return res.status(429).set('Retry-After', '1').json({ error: 'rate limited' });
  }
  applyHistory(req.body, +1);
  res.status(201).json({ added: {}, not_found: { shows: [], movies: [] } });
});
traktApp.post('/sync/history/remove', (req, res) => {
  applyHistory(req.body, -1);
  res.json({ deleted: {}, not_found: {} });
});

// ─── App under test ──────────────────────────────────────────────────────────
let mongo;
let traktServer;
let server;
let base;
let User;

// TMDB stub: every show has 2 seasons of 5 episodes, 30 minutes each.
const TV = (id) => ({
  id,
  name: `Show ${id}`,
  poster_path: null,
  genres: [],
  episode_run_time: [30],
  number_of_episodes: 10,
  status: 'Ended',
  first_air_date: '2020-01-01',
  seasons: [
    { season_number: 1, episode_count: 5 },
    { season_number: 2, episode_count: 5 },
  ],
  last_episode_to_air: { season_number: 2, episode_number: 5 },
  next_episode_to_air: null,
});

test.before(async () => {
  traktServer = await new Promise((resolve) => {
    const s = traktApp.listen(0, () => resolve(s));
  });
  mongo = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGO_URI: mongo.getUri(),
    JWT_SECRET: 'test-secret',
    TMDB_API_KEY: 'unused',
    TRAKT_CLIENT_ID: 'client-id',
    TRAKT_CLIENT_SECRET: 'client-secret',
    TRAKT_API_URL: `http://localhost:${traktServer.address().port}`,
  });
  const tmdb = require('../src/lib/tmdb');
  tmdb.tv = async (id) => TV(Number(id));
  tmdb.movie = async (id) => ({ id: Number(id), title: `Movie ${id}`, runtime: 100, genres: [], status: 'Released', release_date: '2021-01-01' });
  tmdb.season = async (_id, n) => ({
    season_number: n,
    episodes: Array.from({ length: 5 }, (_, i) => ({ episode_number: i + 1, name: `E${i + 1}`, air_date: '2020-01-01' })),
  });
  const app = require('../src/app');
  User = require('../src/models/User');
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://localhost:${server.address().port}/api`;
});

test.after(async () => {
  server?.close();
  traktServer?.close();
  await require('mongoose').disconnect();
  await mongo?.stop();
});

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

/** Mirroring is fire-and-forget, so wait for Trakt to reflect it. */
async function until(check, label) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.fail(`timed out waiting for: ${label}`);
}

async function connectedUser(name) {
  const reg = await call('POST', '/auth/register', { username: name, email: `${name}@example.com`, password: 'longenough' });
  const token = reg.body.token;
  fake.approved = true;
  const polled = await call('POST', '/trakt/device/poll', { deviceCode: 'dev-1' }, token);
  assert.equal(polled.body.state, 'connected');
  return { token, id: reg.body.user.id };
}

function resetFake() {
  Object.assign(fake, { approved: false, refreshes: 0, refreshMode: 'ok', rateLimitNext: 0 });
  fake.shows.clear();
  fake.movies.clear();
  fake.requests.length = 0;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('device login: pending until approved, then connected with username', async () => {
  resetFake();
  const reg = await call('POST', '/auth/register', { username: 'devlogin', email: 'd@example.com', password: 'longenough' });
  const token = reg.body.token;

  const code = await call('POST', '/trakt/device', null, token);
  assert.equal(code.body.userCode, 'ABCD1234');
  assert.equal((await call('POST', '/trakt/device/poll', { deviceCode: 'dev-1' }, token)).body.state, 'pending');
  assert.equal((await call('POST', '/trakt/device/poll', { deviceCode: 'wrong' }, token)).body.state, 'invalid');

  fake.approved = true;
  const done = await call('POST', '/trakt/device/poll', { deviceCode: 'dev-1' }, token);
  assert.deepEqual(done.body, { state: 'connected', username: 'tester' });

  const status = await call('GET', '/trakt/status', null, token);
  assert.equal(status.body.available, true);
  assert.equal(status.body.connected, true);
  assert.equal(status.body.username, 'tester');
});

test('every request identifies Zenith with a User-Agent and the API key', async () => {
  const traktCalls = fake.requests.filter((r) => !r.path.startsWith('/oauth'));
  assert.ok(traktCalls.length > 0);
  for (const r of fake.requests) assert.match(r.ua || '', /^Zenith\//, `${r.path} has User-Agent "${r.ua}"`);
  for (const r of traktCalls) assert.equal(r.key, 'client-id', `${r.path} sends trakt-api-key`);
});

test('watching in Zenith sends each episode to Trakt exactly once; undo removes it', async () => {
  resetFake();
  const { token } = await connectedUser('pusher');
  const added = await call('POST', '/library', { tmdbId: 101, mediaType: 'tv', status: 'watching' }, token);
  const id = added.body.item._id;

  await call('POST', `/library/${id}/progress`, { type: 'watch' }, token); // S1E1
  await call('POST', `/library/${id}/progress`, { type: 'watch' }, token); // S1E2
  await call('POST', `/library/${id}/progress`, { type: 'set', season: 2, episode: 1 }, token); // +S1E3..S2E1
  await until(() => plays(101, 2, 1) === 1, 'S2E1 on Trakt');

  for (const [s, e] of [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 1]]) {
    assert.equal(plays(101, s, e), 1, `S${s}E${e} has exactly one play`);
  }

  await call('POST', `/library/${id}/progress`, { type: 'unwatch' }, token); // back to S1E5
  await until(() => plays(101, 2, 1) === 0, 'S2E1 removed from Trakt');
  assert.equal(plays(101, 1, 5), 1);

  // Movies too.
  const movie = await call('POST', '/library', { tmdbId: 202, mediaType: 'movie', status: 'completed' }, token);
  await until(() => fake.movies.get(202) === 1, 'movie on Trakt');
  await call('POST', `/library/${movie.body.item._id}/progress`, { type: 'unwatch' }, token);
  await until(() => !fake.movies.has(202), 'movie removed from Trakt (unwatch)');
  await call('PATCH', `/library/${movie.body.item._id}`, { status: 'completed' }, token);
  await until(() => fake.movies.get(202) === 1, 'movie back on Trakt (status → completed)');
  await call('PATCH', `/library/${movie.body.item._id}`, { status: 'plan_to_watch' }, token);
  await until(() => !fake.movies.has(202), 'movie removed from Trakt (status → plan to watch)');
});

test('full sync pulls what is ahead on Trakt, pushes what is ahead in Zenith, and is idempotent', async () => {
  resetFake();
  const { token } = await connectedUser('syncer');

  // Zenith: show 101 at S1E3, show 404 only here at S1E2, movie 505 watched only here.
  const s101 = await call('POST', '/library', { tmdbId: 101, mediaType: 'tv', status: 'watching' }, token);
  await call('POST', `/library/${s101.body.item._id}/progress`, { type: 'set', season: 1, episode: 3 }, token);
  const s404 = await call('POST', '/library', { tmdbId: 404, mediaType: 'tv', status: 'watching' }, token);
  await call('POST', `/library/${s404.body.item._id}/progress`, { type: 'set', season: 1, episode: 2 }, token);
  await call('POST', '/library', { tmdbId: 505, mediaType: 'movie', status: 'completed' }, token);
  await until(() => plays(404, 1, 2) === 1 && fake.movies.get(505) === 1, 'live mirrors settled');

  // Trakt: show 101 ahead (watched up to S2E2 elsewhere), show 303 and movie 606 only on Trakt.
  for (const [s, e] of [[1, 4], [1, 5], [2, 1], [2, 2]]) fake.shows.get(101).set(`${s}:${e}`, 1);
  fake.shows.set(303, new Map([['1:1', 1], ['1:2', 1], ['1:3', 1]]));
  fake.movies.set(606, 1);
  // Simulate a library that was never mirrored: Trakt forgot show 404 and movie 505.
  fake.shows.delete(404);
  fake.movies.delete(505);

  const first = await call('POST', '/trakt/sync', null, token);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.deepEqual(first.body, { added: 2, updated: 1, pushed: 2, failed: 0 });

  const lib = (await call('GET', '/library', null, token)).body.items;
  const by = (tmdbId, mediaType) => lib.find((i) => i.tmdbId === tmdbId && i.mediaType === mediaType);
  assert.deepEqual([by(101, 'tv').progress.season, by(101, 'tv').progress.episode], [2, 2], 'pulled 101 forward');
  assert.equal(by(101, 'tv').progress.totalEpisodesWatched, 7);
  assert.deepEqual([by(303, 'tv').progress.season, by(303, 'tv').progress.episode], [1, 3], 'added 303 from Trakt');
  assert.equal(by(606, 'movie').isWatched, true, 'added movie 606 from Trakt');
  assert.equal(plays(404, 1, 1), 1, 'pushed 404 to Trakt');
  assert.equal(plays(404, 1, 2), 1);
  assert.equal(fake.movies.get(505), 1, 'pushed movie 505 to Trakt');

  // Stats picked up the pulled episodes: 101 (3 here + 4 from Trakt), 303 (3), 404 (2) = 12 episodes.
  const stats = await call('GET', '/library/stats?range=all', null, token);
  assert.equal(stats.body.period.episodes, 12);
  assert.equal(stats.body.period.movies, 2);

  const second = await call('POST', '/trakt/sync', null, token);
  assert.deepEqual(second.body, { added: 0, updated: 0, pushed: 0, failed: 0 }, 'second sync is a no-op');
  assert.ok(allPlays().every((n) => n === 1), 'no episode or movie was counted twice on Trakt');
});

test('concurrent requests near token expiry refresh once and stay connected', async () => {
  resetFake();
  const { token, id } = await connectedUser('refresher');
  await User.updateOne({ _id: id }, { $set: { 'trakt.expiresAt': new Date(Date.now() + 60_000) } });

  const show = await call('POST', '/library', { tmdbId: 101, mediaType: 'tv', status: 'watching' }, token);
  const before = fake.refreshes;
  await Promise.all([
    call('POST', `/library/${show.body.item._id}/progress`, { type: 'watch' }, token),
    call('POST', '/library', { tmdbId: 202, mediaType: 'movie', status: 'completed' }, token),
    call('POST', '/library', { tmdbId: 505, mediaType: 'movie', status: 'completed' }, token),
  ]);
  await until(() => plays(101, 1, 1) === 1 && fake.movies.get(202) === 1 && fake.movies.get(505) === 1, 'all three pushed');
  assert.equal(fake.refreshes - before, 1, 'one refresh shared by concurrent requests');
  assert.equal((await call('GET', '/trakt/status', null, token)).body.connected, true);
});

test('a fresh 24-hour token is used as is, not refreshed on every request', async () => {
  resetFake();
  const { token } = await connectedUser('fresh');
  const before = fake.refreshes;
  await call('POST', '/library', { tmdbId: 202, mediaType: 'movie', status: 'completed' }, token);
  await until(() => fake.movies.get(202) === 1, 'movie pushed');
  assert.equal(fake.refreshes - before, 0);
});

test('Trakt being down during refresh does not disconnect; a revoked grant does', async () => {
  resetFake();
  const { token, id } = await connectedUser('outage');
  await User.updateOne({ _id: id }, { $set: { 'trakt.expiresAt': new Date(Date.now() - 1000) } });

  fake.refreshMode = 'down';
  const failed = await call('POST', '/trakt/sync', null, token);
  assert.equal(failed.status, 502);
  assert.equal((await call('GET', '/trakt/status', null, token)).body.connected, true, 'still connected after an outage');

  fake.refreshMode = 'invalid';
  const revoked = await call('POST', '/trakt/sync', null, token);
  assert.equal(revoked.status, 401);
  assert.equal((await call('GET', '/trakt/status', null, token)).body.connected, false, 'disconnected after revoke');
});

test('a rate-limited write is retried instead of failing the sync', async () => {
  resetFake();
  const { token } = await connectedUser('limited');
  await call('POST', '/library', { tmdbId: 505, mediaType: 'movie', status: 'completed' }, token);
  await until(() => fake.movies.get(505) === 1, 'movie pushed');
  fake.movies.delete(505); // Trakt lost it, so the sync must push it
  fake.rateLimitNext = 1;

  const res = await call('POST', '/trakt/sync', null, token);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.pushed, 1);
  assert.equal(fake.movies.get(505), 1);
});
