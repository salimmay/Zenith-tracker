import test from 'node:test';
import assert from 'node:assert/strict';
import { appAdsTxt, normalizePubId, normalizeUrl } from '../src/lib/launch.ts';
import { build } from './helpers.mjs';

const LINE = 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0';

test('publisher id is normalized with or without the pub- prefix', () => {
  assert.equal(normalizePubId('1234567890123456'), 'pub-1234567890123456');
  assert.equal(normalizePubId(' pub-1234567890123456 '), 'pub-1234567890123456');
  assert.equal(normalizePubId('ca-app-pub-1234567890123456'), 'pub-1234567890123456');
  assert.equal(normalizePubId(''), null);
  assert.equal(normalizePubId(undefined), null);
});

test('app-ads.txt is empty until a publisher id exists', () => {
  assert.equal(appAdsTxt(null), '');
  assert.equal(appAdsTxt('pub-1234567890123456'), LINE + '\n');
});

test('blank urls count as not set', () => {
  assert.equal(normalizeUrl(''), null);
  assert.equal(normalizeUrl('   '), null);
  assert.equal(normalizeUrl(undefined), null);
  assert.equal(normalizeUrl('https://play.google.com/store/apps/details?id=x'), 'https://play.google.com/store/apps/details?id=x');
});

test('built app-ads.txt follows the config', () => {
  assert.equal(build('prelaunch').read('app-ads.txt'), '');
  const launched = build('launched', {
    ADMOB_PUBLISHER_ID: '1234567890123456',
    PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.salimmay.zenith',
    SUPPORT_EMAIL: 'help@example.com',
  });
  assert.equal(launched.read('app-ads.txt'), LINE + '\n');
});
