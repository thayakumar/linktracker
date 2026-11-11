# Google Apps Script version

This is a separate, complete web app using the provided Google Sheet as its database. It does not need the Node server or Render. Google Apps Script quotas and spreadsheet size limits apply; it is intended for low-volume use.

## Paste these two files

1. Open the **Apps Script editor for the project behind your existing `/exec` deployment**. The `/exec` link opens the running app, not its source editor. Find the project at https://script.google.com/home if needed. Opening Extensions → Apps Script from the spreadsheet might open a different project; in that case, deploy that project and update `WEB_APP_URL` in the code.
2. Replace `Code.gs` with [Code.gs](./Code.gs).
3. Click **+ → HTML**, name it **Index** (capital I), and paste [Index.html](./Index.html).
4. In **Project Settings → Script Properties**, add `ADMIN_PASSWORD` with a unique password of at least 16 characters. Keep it private. Do not put it in the sheet or source code.
5. In the editor, select **setup** and click **Run**. Approve spreadsheet access under the account that can edit the provided spreadsheet. The script adds `Links` and `Clicks` tabs, writes their headers and preserves `Sheet1` and any other tabs. Existing `Links` or `Clicks` tabs with unexpected headers produce an error instead of being overwritten.
6. Choose **Deploy → Manage deployments → Edit** for the existing web app. Select **New version**, execute as **Me**, and allow access to **Anyone**; then deploy. If creating a new deployment instead, update `WEB_APP_URL` in `Code.gs` to its `/exec` URL and deploy a new version again. Some Google Workspace policies disallow anonymous access; this must be allowed for public links.
7. Open the `/exec` URL without `?r=...`, enter your admin password, and create your first link. The app returns a URL ending in `?r=your-alias`.

**Keep spreadsheet sharing restricted.** The web app runs with your spreadsheet permission, so visitors do not need sheet access. Anyone who can view the spreadsheet can view its raw analytics.

## How tracking works

Visitors see a tracking notice. Pressing **Continue** saves a visit, then displays **Open destination**. This second explicit link works within Apps Script's iframe navigation rules. Initial opens, visitors who stop at the notice, and bots that do not execute JavaScript and continue are **not counted**.

The `Clicks` tab records event ID, link ID, server UTC timestamp, per-link hashed random browser ID, identity quality, user agent, reported platform, language, timezone, screen resolution and likely-bot flag. IP address is explicitly marked unavailable. Device/browser summaries are estimated from user-agent text.

**Google Apps Script does not expose visitor IP addresses or arbitrary HTTP request headers.** It cannot reliably read the original page referrer through its iframe. It cannot obtain precise GPS, exact device name, recipient identity, email, or hardware serial numbers. This app does not request those permissions or use third-party IP services. Keep using the Node server version if you require IP recording.

A random ID is saved to browser local storage only after Continue. Each link estimates unique browsers with a keyed hash of that ID. Storage may be blocked or partitioned in Apps Script's iframe; clearing storage or changing browsers counts again. Without storage, each visit gets a fresh ID and may overcount uniques. Browser-reported details and bot labels are not verified. Summed per-link uniques are not global unique people.

Activity shows the latest 1,000 records for a selected link and exports those records to CSV. All records remain in the spreadsheet until deleted. Delete removes the link and its click records. Copy the spreadsheet before deleting if you need a backup. Do not reorder or rename database columns. Each database tab is capped at 50,000 rows; archive older records before reaching that cap. Full-sheet reads and a script lock make this suitable for modest traffic, not a large analytics service.

The admin session lasts 8 hours and stays in page memory. Sign out clears it from the page. Changing `ADMIN_PASSWORD` invalidates existing tokens. Do not share the password or tokens. The global login throttle permits up to 30 attempts per minute because Apps Script exposes no source IP. Public browser submissions can be automated or fabricated, so click counts should not be treated as proof of identity or used for billing.

## Verification status

Local tests cover initialization, preservation of unrelated tabs, password checks, session invalidation on password changes, URL validation, duplicate aliases, formula-safe values, idempotent event retries, estimated uniques, bot exclusion, deletion, header validation, and browser-script syntax. These tests mock Apps Script services; they do not establish that Google authorization or your web deployment is working.

After deploying, test in a private browser window: create a link as admin, open it as a visitor, press Continue, then Open destination. Refresh the admin dashboard and verify the timestamp and a new row in `Clicks`. A second continuation from the same browser should add a click but retain the unique count when browser storage works.
