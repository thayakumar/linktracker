# LinkScope

A self-hosted link generator with a password-protected analytics dashboard and SQLite persistence. No npm dependencies. Requires Node.js 24+.

## Google Sheets + Apps Script option

For the version that runs entirely in Google Apps Script with your supplied Google Sheet, use the [Apps Script setup guide](apps-script/README.md). It needs no Render service, but cannot collect visitor IP addresses. The instructions below apply to the separate Node server version.

## Deploy from this repository

[Deploy to Render](https://render.com/deploy?repo=https://github.com/thayakumar/linktracker)

The included Render Blueprint creates a Docker web service with a **paid persistent disk**. Review Render's current pricing before creating it. Set `PUBLIC_ORIGIN` to the exact HTTPS origin of your service (no trailing slash), for example `https://linktracker-xxxx.onrender.com`. Render generates `ADMIN_PASSWORD`; retrieve it in Render's environment settings and use it to sign into the dashboard. Don't put the password in the repository or chat.

After deployment, open the service URL, sign in, create a destination link and share the generated `/r/alias` URL. For a custom domain, add it in Render and update `PUBLIC_ORIGIN` to that origin. The link origin and dashboard origin should match.

GitHub stores source code. **GitHub Pages does not run this server or database.** A hosting account is required to bring the application online.

## Local run

Set a strong `ADMIN_PASSWORD` of at least 16 characters in your terminal environment, then run:

```sh
npm start
```

Open http://localhost:3000. SQLite data lives in `data/`. To bind externally use `HOST=0.0.0.0`, and terminate HTTPS at a trusted reverse proxy. Set `PUBLIC_ORIGIN` to your exact public origin. Use `TRUST_PROXY=true` only when your proxy replaces `X-Forwarded-For` with a trustworthy client IP and direct access to the app is blocked; otherwise keep it unset. Spoofed proxy headers can corrupt IP analytics if this is configured incorrectly.

`PORT`, `HOST`, `DATA_DIR`, `PUBLIC_ORIGIN`, `ADMIN_PASSWORD` and `TRUST_PROXY` are runtime environment settings. Do not commit secrets. Docker stores data at `/data`; mount a persistent volume there. Use one application instance with its SQLite disk. Back up the disk using SQLite-aware backups. Sessions expire after 8 hours and reset on restart.

## What is recorded

- UTC request timestamp, source IP, raw user-agent, referring URL and accepted languages, when available.
- Estimated device type, OS and browser derived in the dashboard from user-agent text.
- Likely-bot classification using user-agent heuristics.
- Per-link estimated unique visitors using a keyed hash of IP + user-agent. The dashboard sums per-link uniques; this is not a global unique-person count.

No precise location, email address, exact device name, GPS, camera, microphone or contact list is obtained. IPs may belong to VPNs or proxies. User-agent strings can be reduced or forged. Referrers may be omitted or contain sensitive URL values. Bot detection is approximate. Repeated requests count as clicks; uniqueness is an estimate, not proof of identity.

Visitors see a notice that the visit has been recorded and can choose **Continue to destination**. The initial GET is recorded before the notice is displayed; HEAD requests are not counted. This is a disclosure, not an opt-in consent flow. If your use requires prior consent, change the collection flow before distributing links. No tracking cookies or third-party enrichment services are used.

Records remain until you delete the corresponding link, which deletes its analytics too. Use the tool for links you are authorized to distribute, provide appropriate privacy information to recipients, and delete data you no longer need. CSV exports contain up to the latest 10,000 requests per link. The dashboard is private; public visitors cannot create links or retrieve analytics.

## Verify

```sh
npm test
```

Integration coverage includes authentication, origin validation, unsafe-URL rejection, real click recording, estimated deduplication, bot exclusion, HEAD exclusion, CSV export and deletion. Browser and production hosting checks are separate.
