# LinkScope

A custom link generator with a private analytics dashboard, using the same architecture as [daily-journal-habit-tracker](https://github.com/thayakumar/daily-journal-habit-tracker): **Vite + React → GitHub Pages → Apps Script JSON API → Google Sheets**.

Frontend: https://thayakumar.github.io/linktracker/

## Finish the Google setup

1. Replace your deployment project's **Code.gs** with [apps-script/Code.gs](apps-script/Code.gs). No Index.html file is needed.
2. Set `ADMIN_PASSWORD` (at least 16 characters) under Apps Script **Project Settings → Script Properties**, if not already set.
3. Update the web app deployment to **New version**, execute as **Me**, access **Anyone**. Keep the same `/exec` URL.

The supplied script URL and spreadsheet ID are already configured. The first successful admin login creates the `Links` and `Clicks` tabs, preserving existing records with matching headers and unrelated tabs. No separate setup run or GitHub secret is required. Google may ask you to authorize spreadsheet access when deploying. [Detailed setup and API documentation](apps-script/README.md).

## How it works

`src/lib/sheets-api.ts` sends JSON using `fetch()` without an application/json header, matching the journal app's Apps Script connection. The public script URL comes from optional `VITE_GOOGLE_SCRIPT_URL` configuration, with your current deployment as its default. The URL is visible in the browser. Admin credentials are checked in Apps Script and never embedded in the frontend.

The frontend is deployed by `.github/workflows/deploy.yml` on pushes to `main`. Vite uses `/linktracker/` as its base path. Tracking links are frontend URLs such as `https://thayakumar.github.io/linktracker/?r=summer-launch`.

When a visitor presses Continue on the notice, the app appends an event in Sheets and redirects to the destination. Unique-browser estimates, UTC timestamps, user-agent, platform, language, timezone and screen size are available. Admins can view recent activity, export CSV and delete links with their records.

**Apps Script cannot record visitor IP addresses or exact device names.** Initial link opens and previews are not counted; tracked continuations are counted. Browser IDs estimate unique browsers, not verified people. Full details and limits are in the setup guide. Keep the sheet restricted: public visitors need web-app access, not sheet access.

Unlike the journal's editable snapshots, tracking events append individually so one browser cannot overwrite another browser's events. Failed writes are reported; retries use the same event ID to avoid duplicates. The dashboard reads current cloud data on sign-in and refresh. It does not store analytics or admin tokens in localStorage. The only local storage is a random visitor ID created after Continue.

## Local development

Requires Node.js 24+.

```sh
npm ci
npm run dev
```

Open the printed URL under `/linktracker/`. Your supplied script URL is the default. To override it, copy `.env.example` to `.env` and change `VITE_GOOGLE_SCRIPT_URL`. For GitHub builds, the same optional repository secret or Actions variable overrides the default. Never place a password in a `VITE_` variable.

```sh
npm test
npm run build
npm run preview
```

Tests cover Apps Script setup/auth/routing, click deduplication, unique counts, browser API requests, error handling, tracking URLs and CSV safety. Google authorization and live backend operation must be verified after you update the deployment.

## Optional Node server

The earlier SQLite server remains available with `ADMIN_PASSWORD` set in the environment and `npm start`. It serves `legacy/node-index.html` and is independent of the Vite/Sheets frontend. Its Dockerfile and Render blueprint remain for users who need server-side IP recording. Render requires persistent storage; review its pricing before using it. The default GitHub Pages deployment uses Apps Script and needs no Render service. Earlier iframe-based HTML is retained under `legacy/` for reference and is not used in the current app.
