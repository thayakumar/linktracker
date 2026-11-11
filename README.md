# LinkScope

A custom link generator using **Vite + React → GitHub Pages → Apps Script JSON API → Google Sheets**, matching the daily journal app’s architecture.

Open https://thayakumar.github.io/linktracker/ . **The dashboard now opens directly, with no login.**

## Finish the backend update

Replace your Apps Script project's **Code.gs** with [apps-script/Code.gs](apps-script/Code.gs), then update the existing deployment to **New version**, execute as **Me**, access **Anyone**. Keep the same `/exec` URL. No password properties, Index.html, service-account files, or separate setup run are needed. The spreadsheet and script URL are preconfigured. Google may ask you to authorize spreadsheet access.

The first dashboard request creates missing `Links` and `Clicks` tabs while preserving existing matching records and unrelated tabs. `ADMIN_PASSWORD` is ignored and may be removed. Health endpoint version **4** identifies this no-login backend. [Detailed setup and limits](apps-script/README.md).

**Anyone with the frontend or script URL can view and manage data in this version.** It has no owner-only access enforcement.

## GitHub Pages

The workflow builds and publishes on pushes to `main`. In **Settings → Pages → Source**, choose **GitHub Actions** to stop the older branch-based deployment from overwriting built assets.

`src/lib/sheets-api.ts` uses the optional `VITE_GOOGLE_SCRIPT_URL` environment variable, with the supplied deployment URL as its default. GitHub Actions accepts an optional secret or variable with that name. It is public configuration. Requests use JSON string bodies without an application/json header, as in the journal app. The frontend checks the backend’s confirmation before reporting a successful write.

Tracking links use `https://thayakumar.github.io/linktracker/?r=alias`. When someone opens a tracking link, the frontend appends an event to Sheets and redirects automatically. Unique-browser estimates, server UTC timestamps, browser details, platform, language, timezone and screen size are recorded. Activity and CSV export show up to 1,000 recent events per link. Delete removes a link and its records.

**Apps Script cannot capture visitor IP addresses or exact device names.** Only visits where the tracking JavaScript runs can be counted. Browser IDs estimate browsers, not verified people. Concurrent visitors append individual events instead of replacing a shared snapshot. Failed requests are reported and retries use the same event ID for deduplication.

## Development

Requires Node.js 24+.

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the printed local URL under `/linktracker/`. To override the backend, copy `.env.example` to `.env` and change `VITE_GOOGLE_SCRIPT_URL`.

The earlier standalone Node/SQLite implementation remains available with `npm start` and its own password environment setting. It is separate from the default no-login Sheets app. Legacy HTML files are retained under `legacy/` and are not part of the default deployment.

Automatic redirects wait for the Apps Script recording response. If recording fails, the frontend attempts a destination lookup and redirects without claiming a successful count. Apps Script can take several seconds; this is not an HTTP server redirect. JavaScript and network access are required.
