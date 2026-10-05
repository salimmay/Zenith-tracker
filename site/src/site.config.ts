import { normalizePubId, normalizeUrl } from './lib/launch.ts';

/**
 * Everything that changes when Zenith launches. Edit here, or override with
 * environment variables at build time (the tests use those).
 */
const config = {
  /**
   * Public address of this site.
   *
   * The site itself has moved to https://salimos.cc/zenith and this deployment
   * is now only a 301 (see firebase.json). The value is kept because the Astro
   * build still needs one to resolve canonicals and the sitemap it no longer
   * serves to anybody — do not treat it as the live address.
   */
  siteUrl: 'https://zenith-tracker-api.web.app',
  /** Google Play listing. Leave null until the listing is live: the button shows "Coming soon". */
  playStoreUrl: null as string | null,
  /** Shown on /support. Null hides the email and shows a note instead. */
  supportEmail: 'salimmay.dev@gmail.com' as string | null,
  /** AdMob publisher id (pub-…). Null keeps app-ads.txt empty. */
  admobPublisherId: null as string | null,
};

const env = process.env;

export const site = {
  name: 'Zenith',
  tagline: 'Track every show, movie and anime you watch.',
  siteUrl: normalizeUrl(env.SITE_URL) ?? config.siteUrl,
  playStoreUrl: normalizeUrl(env.PLAY_STORE_URL ?? config.playStoreUrl),
  supportEmail: normalizeUrl(env.SUPPORT_EMAIL ?? config.supportEmail),
  admobPublisherId: normalizePubId(env.ADMOB_PUBLISHER_ID ?? config.admobPublisherId),
};
