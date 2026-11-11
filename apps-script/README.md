# Apps Script JSON backend

This backend follows the same architecture as the daily journal app: GitHub Pages serves a Vite frontend, browser `fetch()` calls Apps Script, and Apps Script reads/writes Google Sheets. **Only Code.gs goes into Apps Script. No HTML file is needed.**

## Three steps in Google

1. In the Apps Script editor behind your existing deployment, replace **Code.gs** with [this file](./Code.gs).
2. Under **Project Settings → Script Properties**, add `ADMIN_PASSWORD` with a private password of at least 16 characters, if it is not already set. Keep any existing `SIGNING_SECRET` property. The first successful admin sign-in automatically creates the missing `Links` and `Clicks` tabs. You may also run `setup` in the editor to authorize and initialize them before deploying.
3. Choose **Deploy → Manage deployments → Edit → New version → Deploy**. Execute as **Me** and allow access to **Anyone**. Keep the same `/exec` URL. Authorize spreadsheet access when Google requests it.

Open https://thayakumar.github.io/linktracker/ and sign in. The frontend already includes the deployment URL you supplied, so a GitHub secret is optional. A deployment not running the JSON API will produce a clear update error in the frontend.

Your spreadsheet ID is already set in `SPREADSHEET_ID` in Code.gs:

`1eJcZCHT2Yw3C0voFxr265Kfsj2Ic0oV6IFz4Hk-R_zk`

It uses `SpreadsheetApp.openById(...)`, so the script can be bound to that spreadsheet or run as a standalone project. Your deployment account must have edit access. `Sheet1` and unrelated tabs are preserved. Existing database tabs with unexpected headers are rejected instead of overwritten. Old click records using the same schema remain available.

## How the frontend connects

`src/lib/sheets-api.ts` reads `VITE_GOOGLE_SCRIPT_URL`. The default is your current public `/exec` URL. Locally, set an optional override in `.env`; in GitHub Actions, set an optional repository secret or variable with the same name. This URL is public configuration, not an access credential. Never put `ADMIN_PASSWORD` or `SIGNING_SECRET` in a `VITE_` variable.

POST requests send a JSON string body **without setting an application/json header**, matching the journal app and avoiding a CORS preflight. Apps Script returns `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }`. The frontend checks the confirmation before reporting success. No `no-cors` fetches, JSONP, OAuth keys or service-account files are needed.

| Action | Access | Purpose |
| --- | --- | --- |
| GET `?action=health` | Public | API version only; no spreadsheet data |
| POST `login` | Password | Issue an 8-hour admin token; create missing tabs |
| POST `getAll` | Admin token | Links and aggregate analytics |
| POST `createLink` | Admin token | Append one link |
| POST `getActivity` | Admin token | Latest 1,000 events for one link |
| POST `deleteLink` | Admin token | Remove link and associated events |
| POST `getLink` | Public | Destination for a supplied link ID |
| POST `recordClick` | Public | Append one visitor event with retry deduplication |

Admin tokens travel in POST bodies, not GET URLs. A publicly callable `getAll` like the journal's would expose the tracker’s private visitor data, so reads that contain analytics require a token. Do not share the admin password. Page memory holds the session; sign-out clears it from the page. Password rotation invalidates existing tokens. A global throttle permits 30 login attempts per minute because Apps Script exposes no client IP.

## Records and limits

`Links` has `id | label | destination | created_utc`.

`Clicks` has `event_id | link_id | timestamp_utc | visitor_hash | identity_quality | user_agent | platform | language | timezone | screen | likely_bot | ip_address`.

Counts start after the visitor presses **Continue** on the frontend notice. It then redirects to the destination. Initial page opens and previews are not counted. Events append individually; the frontend does not upload an old snapshot that could overwrite concurrent visitor events. The server uses a script lock and an event ID to deduplicate retries.

A random first-party browser ID estimates unique browsers per link. Clearing storage, using a different browser, or blocked storage can create another unique estimate. Summed per-link uniques are not global unique people. IP is explicitly marked unavailable: Apps Script does not expose visitor IPs or arbitrary HTTP headers. Precise location, recipient email, exact device name and original referrer are not collected. Device/browser labels come from visitor-reported user-agent text and can be spoofed. Bots that do not run JavaScript or continue are not counted. Public event submissions can be fabricated, so counts are not proof of identity.

**Keep spreadsheet sharing restricted.** Visitors need access to the public web app, not to the sheet. Anyone with sheet access can read the raw analytics. Records remain until the corresponding link is deleted; back up the sheet if needed. Each database tab is capped at 50,000 rows and Apps Script quotas apply. This full-sheet-read implementation suits modest traffic.

## Verify after redeploying

Open the `/exec?action=health` URL. It should return JSON containing `"api":"linkscope","version":3`, not a web page or an Index-file error. This proves the API version is deployed; it does not check spreadsheet authorization.

Sign in on GitHub Pages, create a link, open it in a separate browser tab, press Continue, and confirm a row appears in `Clicks`. Repeating from the same browser should increase continuations while keeping the unique count unchanged when storage works. Activity and CSV export show the latest 1,000 records for a selected link.

Local tests mock Apps Script services. They verify authorization, setup, preservation of unrelated tabs, schema validation, URL restrictions, event deduplication, uniques, bot classification, deletion and JSON routing. They do not replace the live Google authorization and end-to-end checks above.
