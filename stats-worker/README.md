# OTNow anonymous statistics service

This Cloudflare Worker receives the optional anonymous numerical reports described in [the privacy policy](../PRIVACY.md) and serves the public aggregate dashboard.

## Data boundary

The API accepts an exact, allowlisted JSON shape. Every counter must be a non-negative integer, unknown properties are rejected, and the random installation UUID is SHA-256 hashed before it reaches D1. The database has no columns for names, course information, coursework titles, URLs, due dates, grades, emails, student identifiers, Canvas identifiers, IP addresses, or user agents.

Reports from one installation are accepted no more than once every 15 minutes. Normal extension operation reports once per day. Rows inactive for 180 days are removed by the scheduled cleanup. Opt-out deletes the row immediately.

## Public dashboard

The read-only dashboard is available at `/dashboard`. Its JSON endpoint exposes only totals across consenting installations. It never returns installation hashes or individual rows.

Keeping the dashboard and API in the same Worker avoids a second deployment, cross-origin permissions, and duplicated configuration. Cloudflare Pages would be useful for a separate static marketing site, but this service depends on D1-backed server logic; Pages Functions would still execute on the Workers runtime.

## Deployment

1. Authenticate Wrangler with the intended Cloudflare account.
2. Create a D1 database named `otnow-stats` and place its ID in `wrangler.jsonc`.
3. Apply `schema.sql` to the remote database.
4. Deploy with `wrangler deploy --config stats-worker/wrangler.jsonc` from the repository root.

Never commit `.dev.vars`, database exports, or report data. Chrome Web Store installation metrics remain the source of truth for total users; this service counts only consenting reporting installations.
