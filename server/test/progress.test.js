const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../src/lib/progress');

const seasons = [
  { season_number: 0, episode_count: 3 }, // specials
  { season_number: 1, episode_count: 10 },
  { season_number: 2, episode_count: 8 },
];
const order = p.orderSeasons(seasons);
const allAired = { lastAired: { season: 2, episode: 8 }, tmdbStatus: 'Ended' };

test('orderSeasons excludes specials unless opted in', () => {
  assert.deepEqual(order.map((s) => s.number), [1, 2]);
  assert.deepEqual(p.orderSeasons(seasons, true).map((s) => s.number), [0, 1, 2]);
});

test('normalize folds legacy and phantom positions', () => {
  // legacy "start of next season" form
  assert.deepEqual(p.normalize({ season: 2, episode: 0 }, order), { season: 1, episode: 10 });
  // phantom season beyond what TMDB knows
  assert.deepEqual(p.normalize({ season: 5, episode: 0 }, order), { season: 2, episode: 8 });
  // episode beyond season length is clamped
  assert.deepEqual(p.normalize({ season: 1, episode: 99 }, order), { season: 1, episode: 10 });
  // fresh show
  assert.deepEqual(p.normalize({ season: 1, episode: 0 }, order), { season: 1, episode: 0 });
});

test('nextEpisode rolls over seasons and ends', () => {
  assert.deepEqual(p.nextEpisode({ season: 1, episode: 0 }, order), { season: 1, episode: 1 });
  assert.deepEqual(p.nextEpisode({ season: 1, episode: 10 }, order), { season: 2, episode: 1 });
  assert.equal(p.nextEpisode({ season: 2, episode: 8 }, order), null);
});

test('previousPosition steps back across a season boundary', () => {
  assert.deepEqual(p.previousPosition({ season: 2, episode: 1 }, order), { season: 1, episode: 10 });
  assert.deepEqual(p.previousPosition({ season: 1, episode: 1 }, order), { season: 1, episode: 0 });
  assert.deepEqual(p.previousPosition({ season: 1, episode: 0 }, order), { season: 1, episode: 0 });
});

test('countWatched and airedRemaining', () => {
  assert.equal(p.countWatched({ season: 2, episode: 3 }, order), 13);
  assert.equal(p.totalEpisodes(order), 18);
  const meta = { season: 2, episode: 5 };
  assert.equal(p.airedRemaining({ season: 2, episode: 3 }, order, meta), 2);
});

test('episodesBetween spans season boundaries and handles null start', () => {
  const eps = p.episodesBetween({ season: 1, episode: 9 }, { season: 2, episode: 2 }, order);
  assert.deepEqual(eps, [
    { season: 1, episode: 10 },
    { season: 2, episode: 1 },
    { season: 2, episode: 2 },
  ]);
  assert.equal(p.episodesBetween(null, { season: 1, episode: 3 }, order).length, 3);
  assert.equal(p.episodesBetween({ season: 2, episode: 2 }, { season: 2, episode: 2 }, order).length, 0);
});

test('resolveStatus: watching, waiting, completed, manual', () => {
  const returning = { lastAired: { season: 2, episode: 4 }, tmdbStatus: 'Returning Series' };
  assert.equal(p.resolveStatus('watching', { season: 2, episode: 3 }, order, returning), 'watching');
  assert.equal(p.resolveStatus('watching', { season: 2, episode: 4 }, order, returning), 'waiting');
  assert.equal(p.resolveStatus('waiting', { season: 2, episode: 8 }, order, allAired), 'completed');
  // a new episode airing pulls a caught-up show back into watching
  assert.equal(p.resolveStatus('completed', { season: 2, episode: 3 }, order, returning), 'watching');
  assert.equal(p.resolveStatus('dropped', { season: 1, episode: 2 }, order, returning), 'dropped');
});

test('applyAction watch/unwatch/set/complete_season', () => {
  const meta = { seasons, ...allAired };
  const s0 = { status: 'plan_to_watch', progress: { season: 1, episode: 0 } };

  const s1 = p.applyAction(s0, { type: 'watch' }, meta);
  assert.deepEqual(s1.progress, { season: 1, episode: 1, totalEpisodesWatched: 1 });
  assert.equal(s1.status, 'watching');

  const s2 = p.applyAction(s1, { type: 'complete_season', season: 1 }, meta);
  assert.deepEqual(s2.progress, { season: 1, episode: 10, totalEpisodesWatched: 10 });

  // completing an earlier season never moves progress backwards
  const s3 = p.applyAction({ ...s2, progress: { season: 2, episode: 4 } }, { type: 'complete_season', season: 1 }, meta);
  assert.deepEqual(s3.progress, { season: 2, episode: 4, totalEpisodesWatched: 14 });

  const done = p.applyAction(s3, { type: 'set', season: 2, episode: 8 }, meta);
  assert.equal(done.status, 'completed');
  assert.throws(() => p.applyAction(done, { type: 'watch' }, meta), /caught up/);

  const back = p.applyAction(done, { type: 'unwatch' }, meta);
  assert.deepEqual(back.progress, { season: 2, episode: 7, totalEpisodesWatched: 17 });
  assert.equal(back.status, 'watching');
});

test('applyAction refuses unaired episodes', () => {
  const meta = { seasons, lastAired: { season: 2, episode: 2 }, tmdbStatus: 'Returning Series' };
  const state = { status: 'watching', progress: { season: 2, episode: 2 } };
  assert.throws(() => p.applyAction(state, { type: 'watch' }, meta), /hasn't aired/);
});
