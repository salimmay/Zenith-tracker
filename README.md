<div align="center">

<img src="./zenith-client/assets/brand/zenith-logo.svg" alt="Zenith logo" width="96" />

# Zenith

**Your shows, one tap at a time.**

A fast, beautiful tracker for TV shows, anime and movies. Know what's next, check it off with a swipe,
and never miss a premiere — with or without an account.

<!-- Badges: replace the placeholders once CI and the license are in place -->
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](./LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/salimmay/zenith/ci.yml?branch=main)](https://github.com/salimmay/zenith/actions)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contributing)
![Platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS%20%7C%20Web-lightgrey)
![Expo SDK](https://img.shields.io/badge/Expo%20SDK-57-000020)

</div>

![Hero Image](./public/screenshot.png)

> **Zenith** turns "where was I in that show?" into a single tap. Your Up Next list always shows the exact
> next episode, how many are left, and when the next one airs.

---

## ✨ Features

- ⏭️ **Up Next, done right** — the next episode of every show you're watching, with whole-show progress and "12 left" at a glance.
- 👉 **Swipe or tap to mark watched** — momentum-aware swipe, instant feedback, a drawn checkmark, and **Undo** on every action. One gesture can never mark two episodes.
- 🗓️ **Upcoming countdown** — a timeline of premieres, finales and new episodes: *Today*, *6 Days*, *45 Days*.
- 📊 **Stats that mean something** — minutes watched this month, this year or all time, a monthly chart, top genres and most-watched shows.
- 👤 **No account required** — everything works as a guest on-device, and moves into your account the moment you sign up.
- 🔄 **Two-way Trakt sync** — connect with a short device code; every checkmark is mirrored to Trakt without ever double-counting plays.
- 📶 **Built for bad connections** — saved data opens instantly offline, requests time out and retry gracefully, and a calm banner tells you when you're offline.
- 🎬 **Movies and anime too** — separate movie watchlist, anime filter, specials handled correctly.
- 🧭 **Rich details** — seasons with per-episode checks, trailers, cast and recommendations, powered by TMDB.
- 🎨 **Designed to feel native** — dark teal design system, haptics, spring physics and reduced-motion support.

---

## 🛠 Tech Stack

> Both apps live in this repository: **`zenith-client/`** (the app) and **`server/`** (the API).

### Frontend — `zenith-client/`

| Area | Technology |
| --- | --- |
| **Framework** | [Expo](https://expo.dev) SDK 57 · React Native 0.86 · React 19 · TypeScript |
| **Navigation** | Expo Router (file-based, typed routes) — native stack, form sheets, tabs |
| **Data & state** | TanStack Query v5 (with on-device cache persistence) · Zustand · AsyncStorage |
| **Motion & gestures** | Reanimated 4 (UI-thread animations + CSS transitions) · Gesture Handler · Expo Haptics |
| **UI** | `react-native-svg` · Expo Image · Expo Linear Gradient · Ionicons |
| **Platform** | NetInfo (offline awareness) · Keyboard Controller · Google Mobile Ads (AdMob) + consent |
| **Targets** | Android · iOS · Web (via React Native Web) |

### Backend — `server/`

| Area | Technology |
| --- | --- |
| **Runtime** | Node.js ≥ 20 · Express 5 |
| **Database** | MongoDB Atlas · Mongoose 9 |
| **Auth & security** | JWT · bcrypt · Helmet · express-rate-limit · Zod validation |
| **Integrations** | [TMDB API](https://www.themoviedb.org/documentation/api) (metadata, proxied server-side) · [Trakt API](https://trakt.docs.apiary.io) (OAuth device flow, two-way sync) |
| **Testing** | Node's built-in test runner · `mongodb-memory-server` for API integration tests |
| **Deployment** | Stateless container — runs on Google Cloud Run, Vercel or any Node host |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** and npm
- **Git**
- A **MongoDB** connection string — a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works
- A **TMDB API key** — free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
- *For phones:* **Android Studio** (Android SDK + emulator) and/or **Xcode** on macOS (iOS)
- *Optional:* a [Trakt](https://trakt.tv/oauth/applications) app (client ID + secret) to enable Trakt sync

### 1. Clone the repository

```bash
git clone https://github.com/salimmay/Zenith-tracker.git
cd Zenith-tracker
```

### 2. Set up and run the API

```bash
cd server
npm install
cp .env.example .env
```

Open `server/.env` and fill in the values:

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | – | Port for the API. Defaults to `5000`. |
| `MONGO_URI` | ✅ | MongoDB connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/zenith` |
| `JWT_SECRET` | ✅ | Long random string used to sign sessions (command below) |
| `JWT_EXPIRES_IN` | – | Session length. Defaults to `30d`. |
| `TMDB_API_KEY` | ✅ | Your TMDB v3 API key |
| `TRAKT_CLIENT_ID` / `TRAKT_CLIENT_SECRET` | – | Enables "Connect Trakt". Redirect URI: `urn:ietf:wg:oauth:2.0:oob` |
| `ADS_ENABLED` | – | Set to `false` to hide every ad slot remotely. Defaults to on. |
| `CORS_ORIGINS` | – | Comma-separated browser origins allowed in production (for the web build) |

Generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Start the API in watch mode:

```bash
npm run dev
```

> The API is now running at **http://localhost:5000**. Check it with `curl http://localhost:5000/health`.
> On its first database connection it automatically upgrades data from older versions of Zenith.

Run the test suite (unit tests + API integration tests on an in-memory MongoDB):

```bash
npm test
```

### 3. Set up and run the app

In a **second terminal**, from the repository root:

```bash
cd zenith-client
npm install
```

**Web (quickest way to try it):**

```bash
npm run web
```

> Opens at **http://localhost:8081**. In development the app automatically talks to the API on port `5000`.

**Android / iOS (development build):**

Zenith uses native modules (AdMob, Keyboard Controller, NetInfo), so it runs as a **development build** —
**Expo Go is not supported**.

```bash
# Android: emulator running or phone connected with USB debugging enabled
npx expo run:android

# iOS (macOS + Xcode only)
npx expo run:ios
```

> **Physical Android phone over USB?** Forward the dev ports so the phone can reach your computer:
>
> ```bash
> adb reverse tcp:8081 tcp:8081
> adb reverse tcp:5000 tcp:5000
> ```

### 4. App environment variables *(optional)*

Create `zenith-client/.env` only when you need to override the defaults:

| Variable | Description |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Full API URL, e.g. `https://api.example.com`. Defaults to your dev machine on port `5000`. |
| `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` / `EXPO_PUBLIC_ADMOB_BANNER_IOS` | Production AdMob banner unit IDs (development builds always use Google's test ads) |
| `EXPO_PUBLIC_PRIVACY_URL` | Privacy policy link shown in Settings |

Restart the dev server after changing these (`npx expo start --clear`).

### Useful scripts

| Where | Command | What it does |
| --- | --- | --- |
| `server/` | `npm run dev` | API with auto-reload |
| `server/` | `npm start` | API in production mode |
| `server/` | `npm test` | Unit + integration tests |
| `zenith-client/` | `npm start` | Expo dev server |
| `zenith-client/` | `npm run web` | Run in the browser |
| `zenith-client/` | `npm run android` / `npm run ios` | Build and run a development build |
| `zenith-client/` | `npm run typecheck` | TypeScript check |

---

## 📂 Project Structure

```text
zenith/
├── server/                   # Express + MongoDB API
│   ├── index.js              # Entry point (local server / serverless export)
│   ├── src/
│   │   ├── app.js            # Middleware and route wiring
│   │   ├── lib/              # Progress engine, TMDB client, errors
│   │   ├── models/           # User, Show, History (Mongoose)
│   │   ├── routes/           # auth, library, catalog, calendar, trakt
│   │   └── services/         # Library, watch history, Trakt sync
│   └── test/                 # Unit + API integration tests
└── zenith-client/            # Expo app (Android, iOS, Web)
    ├── app.json              # Expo config, icons, plugins
    ├── assets/               # App icons, splash, brand SVG
    └── src/
        ├── app/              # Screens (Expo Router): tabs, details, sheets
        ├── components/       # UI building blocks (cards, loaders, charts)
        ├── data/             # TanStack Query hooks (library, catalog, account)
        ├── ads/              # AdMob slot, consent, kill switch
        ├── store/            # Zustand stores (session, guest library, prefs)
        ├── lib/              # API client, types, formatting, network
        └── theme.ts          # Design tokens
```

---

## 🤝 Contributing

Contributions of every size are welcome — bug reports, ideas, copy fixes and code.

1. **Fork** the repository and create a branch: `git checkout -b feat/your-idea`
2. **Make your change**, keeping the existing style (TypeScript on the client, small focused modules on the server).
3. **Check it** before pushing:
   ```bash
   cd server && npm test
   cd ../zenith-client && npm run typecheck
   ```
4. **Open a pull request** describing *what* changed and *why*. Screenshots or a short screen recording help a lot for UI changes.

> Found a bug but don't have time to fix it? [Open an issue](https://github.com/salimmay/zenith/issues) — a clear description of what happened is already a big help.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

<div align="center">

Metadata and images provided by [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.

</div>
#   Z e n i t h - t r a c k e r  
 