# Zenith website

The launch site for Zenith: landing page, privacy policy, support and `app-ads.txt`.
Static [Astro](https://astro.build) site, hosted on Firebase Hosting.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # builds the site and checks every page
```

## Launch day

Everything that changes at launch lives in [`src/site.config.ts`](src/site.config.ts):

| Setting | What it does |
|---|---|
| `siteUrl` | Canonical address. Change it when a custom domain is connected. |
| `playStoreUrl` | `null` shows "Coming soon to Google Play"; a URL turns it into the download button. |
| `supportEmail` | Shown on `/support`, in the privacy policy and the footer. |
| `admobPublisherId` | Fills `app-ads.txt` (`pub-…`). Empty file while `null`. |

Then put the site URL in the Play Console listing's **Website** field. AdMob reads
`app-ads.txt` from that domain.

## Deploy

First time only:

```bash
npx firebase-tools login
npx firebase-tools projects:addfirebase zenith-tracker-api   # only if Firebase isn't enabled on the project yet
```

Every deploy:

```bash
npm run deploy   # astro build + firebase deploy --only hosting
```

The site is served at `https://zenith-tracker-api.web.app`. To use your own domain,
add it under Hosting → Add custom domain in the Firebase console, then update `siteUrl`.
