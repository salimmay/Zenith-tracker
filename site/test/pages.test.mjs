import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build } from './helpers.mjs';

const PLAY = 'https://play.google.com/store/apps/details?id=com.salimmay.zenith';
const TMDB = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';
const PAGES = ['index.html', 'privacy.html', 'support.html', '404.html'];

const pre = () => build('prelaunch', { SUPPORT_EMAIL: '' });
const launched = () =>
  build('launched', { ADMOB_PUBLISHER_ID: '1234567890123456', PLAY_STORE_URL: PLAY, SUPPORT_EMAIL: 'help@example.com' });

test('every page is built', () => {
  for (const p of PAGES) assert.ok(pre().has(p), `${p} missing`);
  assert.ok(pre().has('sitemap-index.xml'), 'sitemap missing');
  assert.ok(pre().has('robots.txt'), 'robots.txt missing');
});

test('before launch the Play button says coming soon and links nowhere', () => {
  for (const env of [{}, { PLAY_STORE_URL: '' }]) {
    const html = (env.PLAY_STORE_URL === '' ? build('blank-play', env) : pre()).read('index.html');
    assert.match(html, /Coming soon/);
    assert.doesNotMatch(html, /play\.google\.com/);
    assert.doesNotMatch(html, /href=""/);
  }
});

test('after launch the Play button links to the listing', () => {
  const html = launched().read('index.html');
  assert.ok(html.includes(`href="${PLAY.replace(/&/g, '&amp;')}"`), 'Play link missing');
  assert.doesNotMatch(html, /Coming soon/);
});

test('landing page has its sections and accessible images', () => {
  const html = pre().read('index.html');
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, 'exactly one h1');
  assert.equal((html.match(/data-feature/g) || []).length, 3, 'three features');
  assert.equal((html.match(/data-highlight/g) || []).length, 5, 'five highlights');
  for (const img of html.match(/<img\b[^>]*>/g) || []) {
    assert.match(img, /\balt="/, `alt missing: ${img}`);
    assert.match(img, /\bwidth="\d+"/, `width missing: ${img}`);
    assert.match(img, /\bheight="\d+"/, `height missing: ${img}`);
  }
});

test('every page has SEO metadata and the TMDB notice', () => {
  for (const p of PAGES) {
    const html = pre().read(p);
    assert.match(html, /<title>[^<]+<\/title>/, `${p}: title`);
    assert.match(html, /<meta name="description" content="[^"]+"/, `${p}: description`);
    assert.match(html, /<meta property="og:image" content="https:\/\/[^"]+"/, `${p}: og:image`);
    if (p !== '404.html') assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+"/, `${p}: canonical`);
    assert.ok(html.includes(TMDB), `${p}: TMDB notice`);
  }
});

test('support email only renders once it is set', () => {
  assert.doesNotMatch(pre().read('support.html'), /mailto:/);
  assert.match(launched().read('support.html'), /href="mailto:help@example\.com"/);
});

test('privacy page carries the policy', () => {
  const html = pre().read('privacy.html');
  assert.match(html, /Privacy Policy/);
  assert.match(html, /AdMob/);
  assert.match(html, /TMDB/);
});

test('no broken internal links or assets', () => {
  const out = pre();
  for (const file of out.htmlFiles()) {
    const html = out.read(relative(out.dir, file));
    for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
      if (url.startsWith('//')) continue;
      const path = url === '/' ? 'index.html' : url.slice(1);
      const ok = [path, `${path}.html`, join(path, 'index.html')].some((c) => existsSync(join(out.dir, c)));
      assert.ok(ok, `${relative(out.dir, file)} links to missing ${url}`);
    }
  }
});
