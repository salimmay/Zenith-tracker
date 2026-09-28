# Zenith landing page — design

**Date:** 2026-09-28
**Status:** approved in conversation, awaiting written-spec review

## Goal

A launch page for the Zenith app, prepared now and made public when the app goes live
on Google Play (AdMob and the Play listing will be ready by then). It must also provide the
pages Google Play and AdMob require: privacy policy, support contact and `app-ads.txt`.
The page is the first piece of the future Zenith website, so it is built to grow.

## Decisions

| Topic | Decision |
|---|---|
| Purpose | Launch page with a "Get it on Google Play" button, plus privacy, support and `app-ads.txt` |
| Domain | Undecided; the domain is a single config value. Hosted on the free Firebase URL until chosen |
| Language | English only (matches the app) |
| Stack | Astro static site in `site/` |
| Hosting | Firebase Hosting in GCP project `zenith-tracker-api` |

## Page structure (`/`)

1. **Header:** logo and "Zenith" wordmark; a "Get the app" button that scrolls to the download section.
2. **Hero:**
   - **Headline:** "Never lose your place in a show again."
   - **Supporting line:** tracks TV, movies and anime; knows what's next and what's airing.
   - **Main action:** the Play button (see [Launch states](#launch-states)).
   - **Visual:** the Up Next screen in a CSS phone frame, with a soft teal radial glow behind it.
3. **Three features**, one per row with a screenshot (alternating sides on desktop, stacked on mobile):
   - **Up Next:** swipe a card to mark the next episode watched.
   - **Upcoming:** a timeline of new episodes.
   - **Stats:** time watched, a monthly chart and a status breakdown.
4. **Highlights grid** of five small tiles, each with an icon and one line:
   - TV, movies and anime in one place
   - guest mode (no account needed)
   - Trakt sync
   - works offline
   - dark design
5. **Privacy statement:** "Your watch history is yours. We never sell it." Links to `/privacy`.
6. **Final call to action:** the Play button repeated.
7. **Footer:**
   - Privacy · Support
   - TMDB attribution (logo plus "This product uses the TMDB API but is not endorsed or certified by TMDB.")
   - © 2026 Salim May

## Other routes

- **`/privacy`:** the policy from `server/src/privacy.html`, restyled in the site layout. This becomes
  the main copy. The API's `/privacy` stays live because the installed app links to it.
- **`/support`:** the support email (a `mailto:` link) and a short FAQ:
  - account deletion (Settings → Delete account)
  - Trakt connection
  - where the data comes from (TMDB)
  - ads and privacy choices
- **`/app-ads.txt`:** generated at build time from config.
  - An empty file while no AdMob publisher ID is set.
  - With an ID: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`.
- **`/404`:** a simple branded not-found page.

## Launch states

The Play button reads `site.config.ts → playStoreUrl`:

- **`null`:** a non-link badge reading "Coming soon to Google Play".
- **A URL:** the official "Get it on Google Play" badge, linking to the listing.

## Code structure

```
site/
  astro.config.mjs           site URL from config; static output
  firebase.json, .firebaserc hosting config (project zenith-tracker-api)
  package.json               scripts: dev, build, preview, deploy
  src/
    site.config.ts           siteUrl, playStoreUrl, supportEmail, admobPublisherId
    styles/tokens.css        colors, spacing, radii and type mirrored from zenith-client/src/theme.ts
    styles/global.css        reset, base typography, reduced-motion rules
    layouts/Base.astro       <head> (title, description, Open Graph, favicon), Header, Footer
    components/
      Header.astro, Footer.astro
      Hero.astro, Feature.astro, HighlightGrid.astro, PrivacyNote.astro
      PlayButton.astro       the two launch states
      PhoneFrame.astro       CSS device frame around a screenshot
    pages/
      index.astro, privacy.astro, support.astro, 404.astro
      app-ads.txt.ts         endpoint generating the file from config
  public/
    logo.svg, favicon, og-image.png
    screens/*.webp           app screenshots
```

Each component has one job and takes its content as props, so the future website can reuse them.

## Visual design

- **Brand:** the app's tokens, e.g. background `#0E1111`, surface `#161B1B`, teal `#80CBC4`,
  deep teal `#1C3B38`, amber `#F2B45C`. Dark theme only, matching the app.
- **Type:** a system font stack (no web-font download), large tight headline, comfortable line length (~65ch).
- **Layout:** mobile-first. 16 px side gutters on phones, content max width about 1120 px, no horizontal scroll.
- **Motion:**
  - sections fade and rise 12 px when they scroll into view (IntersectionObserver, a few lines of JS)
  - the hero phone rises gently on load
  - everything is disabled under `prefers-reduced-motion`
- **Screenshots:**
  - captured from the Expo web preview at phone size, with realistic sample data
  - exported as WebP, with width and height set so nothing shifts while loading

## SEO and metadata

- A title and meta description on every page.
- Open Graph and Twitter card tags with `og-image.png` (1200×630, logo plus the hero phone).
- A canonical URL from `siteUrl`, and `sitemap.xml` via `@astrojs/sitemap`.

## Deployment

- `npm run deploy` in `site/` runs `astro build`, then `firebase deploy --only hosting`.
- The first deploy needs the user's `firebase login`; after that the command is repeatable.
- **Default URL:** `https://zenith-tracker-api.web.app`.
- **Custom domain later:** connect it in the Firebase console, then set `siteUrl`.

## Follow-ups at launch (not part of this build)

- Set `playStoreUrl` and `admobPublisherId`, then redeploy.
- Point `EXPO_PUBLIC_PRIVACY_URL` in `zenith-client/.env` to `<site>/privacy`.
- Put the site URL in the Play listing's "Website" field (AdMob reads `app-ads.txt` from there).

## Testing

- `astro build` succeeds with no warnings.
- Visual check at 375 px and 1280 px wide: no overflow, and the screenshots stay sharp.
- Lighthouse (mobile): Performance, Accessibility, Best Practices and SEO all 95 or higher.
- Launch states: the Play button renders "Coming soon" with `playStoreUrl: null`, and the linked
  badge with a URL.
- `app-ads.txt`: empty without a publisher ID; exactly one correct line with one.
- `/privacy`, `/support` and `/404` render. Every link on the page resolves.

## Open item

- **`supportEmail`:** which address to show publicly. The user's account email, or a
  separate support address. It's one config value, so it doesn't block the build.
