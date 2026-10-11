# QuestTime

A pixel-art habit game: daily quests, streaks, subjects, a growing grove. Runs as a web app (PWA) and as an Android app via Capacitor. All data stays on the device.

## Layout

```
src/
  index.html          page markup with three injection points
  styles/NN-*.css     styles, concatenated in filename order
  js/NN-*.js          app code, concatenated in filename order into one closure
  assets/achievements.json
public/               copied as-is into dist/ (fonts, icons, vendor, manifest)
  sw.template.js      service worker; __VERSION__ is filled in at build time
tests/                Playwright tests (desktop, phone, rules, data)
build.mjs             builds dist/
capacitor.config.json Android wrapper (webDir: dist)
scripts/add-permissions.cjs
assets/               source images for the Android icon
```

The JS files share one scope, so order matters: `00-core.js` defines state and helpers, later files use them. Keep new code in the file for its feature, or add a new numbered file.

## Commands

```
npm install
npx playwright install chromium
npm run build
npm test
npm run serve
```

`npm run build` writes `dist/` and stamps the service-worker cache with the package version plus a content hash, so every build refreshes installed copies automatically. `npm run serve` opens it at http://localhost:8080.

## Releasing the web version

Pushing to `main` runs the tests and, if they pass, deploys `dist/` to GitHub Pages (`.github/workflows/pages.yml`). One-time setup: repo Settings → Pages → Source: **GitHub Actions**.

Bump `version` in `package.json` for meaningful releases; the cache name changes on every build regardless.

## Android

First time:

```
npm run build
npx cap add android
node scripts/add-permissions.cjs
npx @capacitor/assets generate --android
npx cap sync android
node scripts/add-native.cjs
cd android
./gradlew assembleDebug
```

After that, `npm run android:apk` rebuilds the web app, syncs, re-adds the native plugin and builds.

`native/android/` holds the one piece of native code: `FocusNotifyPlugin`, which shows a live ticking timer in the notification shade and on the lock screen while you focus. `scripts/add-native.cjs` copies it into the generated `android/` project and registers it in `MainActivity`.

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Installing over an older build keeps data as long as the `appId` and the debug signing key (on this machine) stay the same.

## Data and schema

Everything is stored in `localStorage` under `pc-cache-v1`; backups are the same data as JSON. `SCHEMA` in `src/js/00-core.js` is the current data version. When the stored shape changes:

1. Bump `SCHEMA`.
2. Add a step to `migrate()` that upgrades older data.
3. Add a test in `tests/data.spec.mjs` that imports an old backup.

Backups from a newer schema are refused with a message rather than half-imported.

## Testing

`npm test` builds and runs every spec headlessly. The tests drive the real page with a fake clock and seeded storage, so they cover streak and day rules, carried days, strict mode, the timer flow, backups, and phone layouts. Run one file with `npx playwright test tests/rules.spec.mjs`.
