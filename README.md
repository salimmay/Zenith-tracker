# Zenith

A TV, anime and movie tracker: Up Next with one-tap (or swipe) check-offs, a library,
a release calendar, stats, and two-way Trakt sync. It works without an account;
everything moves into your account when you sign up.

```
server/         Express + MongoDB API (deployed on Vercel)
zenith-client/  Expo app — iOS, Android and web
```

## Run it locally

**API**

```bash
cd server
cp .env.example .env   # then fill in MONGO_URI, JWT_SECRET, TMDB_API_KEY (Trakt keys optional)
npm install
npm run dev            # http://localhost:5000
npm test               # progress-engine tests
```

**App**

```bash
cd zenith-client
npm install
npx expo start         # press i / a / w, or scan the QR code with Expo Go
```

In development the app finds the API on the machine running Metro (port 5000), so Expo Go on a
real phone works without config. Point it elsewhere with `EXPO_PUBLIC_API_URL=https://your-api`.

## How progress works

`server/src/lib/progress.js` is the single source of truth for "what's next": season rollover,
specials, unaired episodes, and whether a show is **Watching**, **Up to date** (caught up,
more coming) or **Completed** (ended). Guests use the same engine through the public
`/api/catalog/progress/*` routes, so behaviour is identical with or without an account.

Legacy v1 data is upgraded automatically on the API's first database connection
(`server/src/db.js`): `mediaType` is added, statuses are lower-cased, and the unique index
becomes `(userId, tmdbId, mediaType)`.

## API overview

| Route | |
|---|---|
| `POST /api/auth/register`, `/login` · `GET/PATCH/DELETE /api/auth/me` | Accounts & settings |
| `GET /api/library` · `/up-next` · `/stats` · `/lookup/:type/:id` | Library reads |
| `POST /api/library` · `PATCH /:id` · `POST /:id/progress` · `DELETE /:id` | Library writes |
| `POST /api/library/sync-local` | Merge a guest library into the account |
| `GET /api/calendar` | Upcoming episodes |
| `/api/catalog/*` (public) | TMDB search, lists, details, guest progress |
| `/api/trakt/*` | Device-code connect, full sync, disconnect |
