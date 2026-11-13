# Emotional Trigger Tracker

A private, offline web app for noticing which emotions come before an urge to
engage in an unwanted habit. Built for one person on one iPhone (designed and
checked at the iPhone 17 Pro Max size, 440 × 956 points), installed from
Safari to the Home Screen.

- **No account, no server, no tracking.** All data lives in IndexedDB on the device.
- **Works offline** once installed.
- **Not a medical tool.** It records and counts; it does not diagnose or claim causes.

## Commands

```bash
npm install        # once
npm run dev        # development server at http://127.0.0.1:5173
npm test           # run the test suite (Vitest + React Testing Library)
npm run lint       # oxlint
npm run build      # production build into dist/
npm run preview    # serve dist/ locally (service worker active)
npm run icons      # regenerate the app icons in public/
```

## Deploy to Netlify and install on your iPhone

1. Push this folder to a GitHub repository (or drag the `dist/` folder onto
   Netlify's "Deploy manually" page after `npm run build`).
2. In Netlify: **Add new site → Import from Git**, pick the repo. If the repo
   root is the folder *above* this one, set **Base directory** to
   `impulse-tracker`. Build command and publish directory come from
   `netlify.toml` (`npm run build`, `dist`). Netlify serves it over HTTPS,
   which service workers require.
3. On the iPhone, open the site in **Safari** (not Chrome; only Safari can
   install web apps with offline support on iOS).
4. Tap **Share → Add to Home Screen → Add**.
5. Open it from the Home Screen icon once while online. A toast says
   "Ready to use without an internet connection".

Install from the Home Screen rather than using a Safari tab: Safari may clear
a website's storage after weeks without visits, but Home Screen apps are
exempt.

### Updating the app

Push a change and Netlify rebuilds. The next time you open the app online it
downloads the new version in the background and shows **"A new version is
ready → Update"**. Updates replace code only; your entries in IndexedDB are
untouched. Database structure changes go through versioned migrations (see
below), so records never disappear on update.

### Backups

Your data exists only on the phone. Use **Settings → Export backup (JSON)**
now and then (Save to Files / iCloud Drive). **Import backup** shows a preview
and either merges (default, never deletes) or replaces everything.

## Project structure

```
src/
  data/        emotion taxonomy, default tags/strategies, habit icons (plain data)
  db/          Dexie database, schema versions, repositories (all reads/writes)
  services/    pure logic: analytics, insights, backup/CSV, PIN hashing
  hooks/       React hooks (live database queries, theme, "today")
  components/  reusable UI: layout, dialogs, emotion picker, entry cards, charts
  features/    larger pieces of specific screens (log form, settings sections…)
  pages/       one component per route
  styles/      tokens (colors, spacing), base, layout, components, features
  test/        test setup and helpers
```

Key design decisions, in brief:

- **Repositories, not direct database calls.** Pages call functions such as
  `createEntry()`; only `src/db/` knows about Dexie. A future cloud sync can be
  added behind these functions without touching the UI. Records use random
  UUIDs plus `createdAt`/`updatedAt`, which a sync can merge on.
- **Live queries.** `useLiveQuery` re-runs reads when data changes, so History
  and the Dashboard update right after saving, without a global state library.
- **Pure analytics.** `src/services/analytics.js` takes arrays and returns
  numbers, keeping the three counts distinct: *urge events* (entries), *emotion
  selections*, and *events involving a category* (once per entry per category,
  so category shares can exceed 100%).
- **Timestamps** are stored as UTC ISO strings and shown in local time.
- **Colors** live in `src/styles/tokens.css` (light and dark). The six emotion
  colors follow the wheel's hues; their exact shades and the chart order were
  checked for color-blind separation. Categories always carry a text label and
  an icon too, never color alone.

### Changing the database structure

Append a new entry to `SCHEMA_VERSIONS` in `src/db/database.js` (never edit an
old one) and optionally add an `upgrade(transaction)` function. Dexie runs the
missing steps when the updated app opens. `src/db/migrations.test.js` shows
the pattern.

## ⚠️ Emotion wheel: please review the outer ring

The emotion-wheel image was **not in the workspace**, so it could not be used
to verify the taxonomy. In `src/data/emotionTaxonomy.js`:

- The **6 primary and 36 secondary** emotions match your written transcription
  exactly (a test enforces this).
- The **72 tertiary** emotions come from the widely published six-category
  wheel whose inner rings match your transcription. They are unverified
  against your copy, flagged by `TERTIARY_LEVEL_VERIFIED = false` and shown in
  Settings → About.

To correct it, edit the labels in that file (IDs must stay stable once you have
real entries) and set the flag to `true`. Duplicate labels are kept distinct
by ID, e.g. "Inadequate (Insecure)" vs "Inadequate (Rejected)".

## Privacy notes

- The optional PIN is a **privacy screen, not encryption**. It stores only a
  salted PBKDF2 hash, but the entries themselves are unencrypted in the
  browser. Your iPhone passcode / Face ID is the real protection. Forgetting
  the PIN means erasing the app's data (restore from a backup afterwards).
- `netlify.toml` sets a Content-Security-Policy that blocks connections to any
  other server, so the app cannot send data anywhere.
- The service worker caches only the app's own files, never your entries.
