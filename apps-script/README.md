# Apps Script JSON backend — no-login version

Only `Code.gs` is needed in Apps Script. The frontend runs on GitHub Pages and exchanges JSON with this backend, matching the daily journal architecture.

## Update your deployment

1. Replace **Code.gs** in your existing Apps Script project with [this file](Code.gs).
2. Choose **Deploy → Manage deployments → Edit → New version → Deploy**, executing as **Me**, accessible to **Anyone**. Keep the same `/exec` URL.
3. Open https://thayakumar.github.io/linktracker/ . The dashboard loads directly; no password or sign-in is used. Missing `Links` and `Clicks` tabs are created on the first dashboard request. Google may request spreadsheet authorization when deploying.

`ADMIN_PASSWORD` is no longer read and may be removed. Keep any existing `SIGNING_SECRET` to preserve the visitor hashing key; the script generates it automatically when missing. It is an internal hashing key, not a login credential.

The script is already configured for spreadsheet `1eJcZCHT2Yw3C0voFxr265Kfsj2Ic0oV6IFz4Hk-R_zk`. Existing matching database tabs and unrelated tabs are preserved. Unexpected headers produce an error instead of overwriting data. The deployment owner needs spreadsheet edit access.

**All API operations are public in this version, as requested.** Anyone who discovers the frontend or script URL can view analytics, create links, and delete links with their records. Keeping the sheet itself restricted prevents direct sheet access but does not restrict this public API.

## Frontend connection

`src/lib/sheets-api.ts` uses `VITE_GOOGLE_SCRIPT_URL`, defaulting to your supplied deployment. An optional `.env` setting or GitHub Actions secret/variable of that name overrides it. The URL is public configuration. POST bodies contain JSON text without an application/json header, avoiding a CORS preflight. Responses are `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }`.

GET `?action=health` returns `{"success":true,"data":{"api":"linkscope","version":4}}`. If it reports version 3, update the deployment to the latest code. POST actions are `getAll`, `createLink`, `getActivity`, `deleteLink`, `getLink`, and `recordClick`. None requires a password or token.

## Storage and tracking

`Links` columns: `id | label | destination | created_utc`.

`Clicks` columns: `event_id | link_id | timestamp_utc | visitor_hash | identity_quality | user_agent | platform | language | timezone | screen | likely_bot | ip_address`.

Visits are recorded after a visitor presses Continue, then the frontend redirects to the destination. Initial page opens and previews are not counted. Events append individually under a script lock. Retrying the same event ID does not duplicate an event.

Unique browsers are estimated per link with a hashed random browser ID. Clearing browser storage, changing browsers, or blocked storage may increase unique estimates. The sum across links is not a count of unique people. Client-supplied fields can be fabricated. Bot detection is approximate, and bots that never continue are not counted.

Apps Script does not expose visitor IP addresses or arbitrary HTTP headers. IP is marked unavailable. Exact device names, precise location, recipient identities and original referrers are not collected. Platform, browser/device estimates, language, timezone and screen size come from the browser.

Activity and CSV export include the latest 1,000 events for a link. Records remain until the link is deleted. Each tab is capped at 50,000 rows; archive old records before reaching that limit. Full-sheet reads and Apps Script quotas make this suitable for modest traffic.

## Verify

After redeploying, check `?action=health` for version 4, open the frontend, create a link, open it in another tab and press Continue. Refresh the dashboard and confirm a row appears in `Clicks`. Repeat from the same browser to check the unique estimate when storage is available.

Local tests mock Apps Script services; live authorization and deployment still need the checks above. No password setup or Index.html file is needed.
