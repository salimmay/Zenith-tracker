# Zenith Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static Astro launch site in `site/` (landing, privacy, support, 404, app-ads.txt), deployable to Firebase Hosting.

**Architecture:** An Astro 5+ static build with no framework islands. One config module drives everything that
changes at launch, and env vars override it so tests can build both launch states. Build output is
verified by `node:test` specs that read `dist/`.

**Tech Stack:** Astro 5, @astrojs/sitemap, plain CSS (tokens mirrored from `zenith-client/src/theme.ts`),
node:test, firebase-tools.

**Spec:** `docs/superpowers/specs/2026-09-28-landing-page-design.md`

## Global Constraints

- English only; dark theme only; brand tokens identical to `zenith-client/src/theme.ts` colors.
- No web fonts, no client framework; the only JS is the scroll-reveal observer (under 1 KB).
- Mobile-first: 16 px gutters, max content width 1120 px, no horizontal scroll at 375 px.
- `prefers-reduced-motion: reduce` disables all motion.
- TMDB attribution text, exactly: "This product uses the TMDB API but is not endorsed or certified by TMDB."
- The `app-ads.txt` line format is exactly: `google.com, <pub-id>, DIRECT, f08c47fec0942fa0`.

## Review Focus

1. **Publisher ID entered with or without the `pub-` prefix:** the file must contain exactly one `pub-…` prefix.
   Test: build with `ADMOB_PUBLISHER_ID=1234567890123456` and with `pub-1234567890123456`; both must produce the same line.
2. **Play URL empty string rather than null:** treat it as "coming soon" and never render a dead `href=""`.
   Test: build with `PLAY_STORE_URL=""` and assert "Coming soon".
3. **Support email not set yet:** `/support` must still render (FAQ plus a note) without a broken `mailto:`.
   Test: a build with no email has no `mailto:` link.
4. **Internal links:** every `href="/…"` in `dist` resolves to a built file.
   Test: a link crawler over `dist/**/*.html`.
5. **Narrow phones:** no fixed widths above 375 px in the CSS. Checked visually at 375 px in the browser (manual step in Task 5).

---

### Task 1: Scaffold + config + app-ads.txt

**Files:**
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/.gitignore`,
  `site/src/site.config.ts`, `site/src/pages/app-ads.txt.ts`, `site/test/build.test.mjs`

**Interfaces:**
- **Produces:** `site.config.ts` exports `site` with these fields:
  - `siteUrl: string`
  - `playStoreUrl: string | null`
  - `supportEmail: string | null`
  - `admobPublisherId: string | null` (normalized to `pub-…`)

  It also exports `appAdsTxt(pubId: string | null): string`.

**Steps:**
- [ ] **Step 1.** Write `test/build.test.mjs` with an `appAdsTxt` test (empty without an ID; normalizes the prefix) and a dist test for `app-ads.txt`.
- [ ] **Step 2.** Run `npm test` and confirm it fails.
- [ ] **Step 3.** Implement the config, the endpoint and `astro.config.mjs` (static output, sitemap, `site` from config).
- [ ] **Step 4.** Run `npm test` and confirm it passes.
- [ ] **Step 5.** Commit.

### Task 2: Tokens, layout, header/footer, PlayButton

**Files:** `src/styles/tokens.css`, `src/styles/global.css`, `src/layouts/Base.astro`,
`src/components/{Header,Footer,PlayButton}.astro`, `public/logo.svg`, `public/favicon.svg`

**Steps:**
- [ ] Add tests for the launch states: `PLAY_STORE_URL` unset or `""` gives "Coming soon" with no `play.google.com` link; a URL gives a link to it.
- [ ] Add a test that the footer's TMDB text and link appear on every page.

### Task 3: Landing sections + screenshots

**Files:** `src/components/{Hero,Feature,HighlightGrid,PrivacyNote,PhoneFrame}.astro`,
`src/pages/index.astro`, `public/screens/*.webp`

**Steps:**
- [ ] Capture the screenshots from the Expo web preview:
  - at 390×844, against the live API
  - with a seeded guest library (zustand key `zenith-guest-library` in localStorage)
  - converted to WebP with sharp
- [ ] Add a test: the index has an h1, three features, five highlight tiles, and every `<img>` has width, height and alt.

### Task 4: Privacy, support, 404, SEO

**Files:** `src/pages/{privacy,support,404}.astro`, `public/og-image.png`, `public/robots.txt`

**Steps:**
- [ ] Add tests:
  - every page has a title, description, canonical URL and `og:image`
  - `/support` has no `mailto:` when the email is null, and has one when it's set
  - `sitemap-index.xml` exists
  - the link crawler finds no broken internal links

### Task 5: Firebase config + verification

**Files:** `site/firebase.json`, `site/.firebaserc`, deploy script, `README` section.

**Steps:**
- [ ] Set `firebase.json` so `public` is `dist`, with clean URLs, cache headers for assets, and `text/plain` for `app-ads.txt`.
- [ ] Manual check in the browser at 375 px and 1280 px; Lighthouse at 95+ for all four categories.
- [ ] Deploy only after the user runs `firebase login`. The user runs the first deploy.
