// End-to-end API test against an in-memory MongoDB, with TMDB stubbed out.
const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let server;
let base;
let Show;
let History;

// A 2-season show (5 + 5 episodes, 30 min) and a 100-minute movie.
const TV = {
  id: 101,
  name: 'Test Show',
  poster_path: '/p.jpg',
  backdrop_path: null,
  genres: [{ id: 18, name: 'Drama' }],
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
};
const MOVIE = { id: 202, title: 'Test Movie', runtime: 100, genres: [], status: 'Released', release_date: '2021-05-05' };

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  process.env.JWT_SECRET = 'test-secret';
  process.env.TMDB_API_KEY = 'unused';

  const tmdb = require('../src/lib/tmdb');
  tmdb.tv = async () => TV;
  tmdb.movie = async () => MOVIE;
  tmdb.season = async (_id, n) => ({
    season_number: n,
    episodes: Array.from({ length: 5 }, (_, i) => ({ episode_number: i + 1, name: `E${i + 1}`, air_date: '2020-01-01' })),
  });

  const app = require('../src/app');
  Show = require('../src/models/Show');
  History = require('../src/models/History');
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}/api`;
});

test.after(async () => {
  server?.close();
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

test('history-backed stats follow watches, undo, movies and removal', async () => {
  const reg = await call('POST', '/auth/register', { username: 'tester', email: 't@example.com', password: 'longenough' });
  assert.equal(reg.status, 201);
  const token = reg.body.token;
  const userId = reg.body.user.id;

  // A library from before history existed: 5 episodes of a 50-minute show.
  await Show.create({
    userId,
    tmdbId: 999,
    mediaType: 'tv',
    showName: 'Legacy',
    runtime: 50,
    status: 'watching',
    progress: { season: 1, episode: 5, totalEpisodesWatched: 5 },
    lastWatchedAt: new Date(),
  });

  const added = await call('POST', '/library', { tmdbId: 101, mediaType: 'tv', status: 'watching' }, token);
  assert.equal(added.status, 201);
  const id = added.body.item._id;

  await call('POST', `/library/${id}/progress`, { type: 'watch' }, token); // E1
  await call('POST', `/library/${id}/progress`, { type: 'watch' }, token); // E2
  const set = await call('POST', `/library/${id}/progress`, { type: 'set', season: 1, episode: 5 }, token); // +E3..E5
  assert.equal(set.body.item.progress.totalEpisodesWatched, 5);
  await call('POST', `/library/${id}/progress`, { type: 'unwatch' }, token); // -E5

  // Backfill (5 × 50) + four logged episodes (4 × 30).
  let stats = await call('GET', '/library/stats?range=all', null, token);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.period.minutes, 250 + 120);
  assert.equal(stats.body.period.episodes, 9);
  assert.equal(await History.countDocuments({ userId, source: 'import' }), 1);

  const movie = await call('POST', '/library', { tmdbId: 202, mediaType: 'movie', status: 'completed' }, token);
  assert.equal(movie.status, 201);
  stats = await call('GET', '/library/stats?range=month&type=movie', null, token);
  assert.equal(stats.body.period.minutes, 100);
  assert.equal(stats.body.period.movies, 1);

  const thisMonth = new Date().toISOString().slice(0, 7);
  stats = await call('GET', '/library/stats?range=year', null, token);
  assert.equal(stats.body.monthly.find((m) => m.month === thisMonth)?.minutes, 470);

  // Removing a title takes its time out of the stats.
  await call('DELETE', `/library/${id}`, null, token);
  stats = await call('GET', '/library/stats?range=all', null, token);
  assert.equal(stats.body.period.minutes, 350);
});

test('health/db pings the database (keep-alive endpoint)', async () => {
  const res = await fetch(base.replace(/\/api$/, '/health/db'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, db: 'up' });
});

test('config exposes the ads kill switch and users start with ads', async () => {
  delete process.env.ADS_ENABLED;
  assert.equal((await call('GET', '/config')).body.ads.enabled, true);
  process.env.ADS_ENABLED = 'false';
  assert.equal((await call('GET', '/config')).body.ads.enabled, false);
  delete process.env.ADS_ENABLED;

  const reg = await call('POST', '/auth/register', { username: 'adsuser', email: 'ads@example.com', password: 'longenough' });
  assert.equal(reg.body.user.adFree, false);
});

test('guest history is imported on sync-local', async () => {
  const reg = await call('POST', '/auth/register', { username: 'guesty', email: 'g@example.com', password: 'longenough' });
  const token = reg.body.token;
  const res = await call(
    'POST',
    '/library/sync-local',
    {
      items: [{ tmdbId: 101, mediaType: 'tv', status: 'watching', progress: { season: 1, episode: 2 } }],
      history: [{ tmdbId: 101, mediaType: 'tv', episodes: 2, minutes: 60, watchedAt: new Date().toISOString() }],
    },
    token
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.added, 1);
  const stats = await call('GET', '/library/stats?range=all', null, token);
  assert.equal(stats.body.period.minutes, 60);
  assert.equal(stats.body.period.episodes, 2);
});
