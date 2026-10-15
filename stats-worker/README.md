# OTNow public site and anonymous statistics service

This Cloudflare Worker serves OTNow's public product site, receives the optional anonymous numerical reports described in [the privacy policy](../PRIVACY.md), and serves the aggregate dashboard.

## Product landing page

The public root at `/` is OTNow's link hub and product introduction. It links directly to the signed Chrome Web Store build, the submitted Firefox release track, live statistics, privacy policy, feedback form, Ko-fi page, support page, source code, changelog, and private vulnerability reporting. It does not add any extension permission or analytics dependency.

The page uses a light, Canvas-adjacent OTNow palette with an optional dark theme. Its hero shows the real sanitized OTNow sidebar beside an Ontario Tech Canvas dashboard, while later sections demonstrate changed-date detection, organization, and local announcement cleanup rather than relying on generic feature cards. Dependency-free course-colour particles, cursor reactions, click sparks, scroll reveals, subtle product tilt, and live count-up values provide the animation layer. It honours `prefers-reduced-motion`, includes an explicit motion control, and disables pointer-heavy effects on coarse-pointer devices. The live counters reuse `/api/stats` and retain its opt-in boundary instead of implying that reporting installations equal all users.

The bundled static-asset binding exposes the existing sanitized screenshots in `docs/media` to the Worker. `/product-preview.png` deliberately maps to the real deadline screenshot used by the landing page; coursework shown there is fictionalized and sanitized.

The social preview artwork is served at `/social-card.svg`. Firefox remains labelled as submitted until Mozilla publishes the listing and the signed build passes final installation testing.

## Data boundary

The statistics API accepts an exact, allowlisted JSON shape. Every counter must be a non-negative integer, unknown properties are rejected, and the random installation UUID is SHA-256 hashed before it reaches D1. Its installation table has no columns for names, course information, coursework titles, URLs, due dates, grades, emails, student identifiers, Canvas identifiers, IP addresses, or user agents.

Reports from one installation are accepted no more than once every 15 minutes. Normal extension operation reports once per day. Rows inactive for 180 days are removed by the scheduled cleanup. Opt-out deletes the row immediately.

## Public dashboard

The read-only dashboard is available at `/dashboard`, and the matching themed privacy policy is available at `/privacy`. The JSON endpoint exposes only totals across consenting installations. It never returns installation hashes or individual rows.

The dashboard fits into one viewport and uses direct, descriptive copy. It shows reporting installations, items organized, and the optional community rating average. A separate, clearly labelled line shows the Chrome Web Store average and rating count; it is never merged with OTNow's first-party community rating. Exact activity windows, version distribution, per-type totals, and installation history are not exposed by the public API. Aggregate totals are exact. The interface switches to compact notation only when a value becomes too wide, and the exact count remains available through the value's title and accessible label. Public responses are cached for one hour without write-triggered invalidation. Visitors can submit a one-to-five-star rating directly from the page. The rating table stores only the selected number and submission time; browser storage discourages accidental repeat ratings.

The existing daily scheduled job fetches the public Chrome Web Store listing once, validates its accessibility-labelled rating and count, and stores only those two public values plus the check time. If the request or parser fails, the last known good value remains available and the dashboard continues normally. The Store-management API does not expose ratings, so this isolated refresh is deliberately not part of any dashboard request.

Written feedback uses a separate Google Form linked from the header and footer. The form does not collect email addresses, makes the name field optional, and writes responses to a private Google Sheet for review.

The dashboard interface uses dependency-free cursor-reactive particles, count-up values, spotlight reactions, click sparks, and spring-like star feedback inspired by React Bits. Motion is disabled when the visitor requests reduced motion.

Keeping the dashboard and API in the same Worker avoids a second deployment, cross-origin permissions, and duplicated configuration. Cloudflare Pages would be useful for a separate static marketing site, but this service depends on D1-backed server logic; Pages Functions would still execute on the Workers runtime.

## Deployment

1. Authenticate Wrangler with the intended Cloudflare account.
2. Create a D1 database named `otnow-stats` and place its ID in `wrangler.jsonc`.
3. Apply `schema.sql` for a new database, or apply every unapplied file in `stats-worker/migrations` to an existing database.
4. Deploy with `wrangler deploy --config stats-worker/wrangler.jsonc` from the repository root.

Never commit `.dev.vars`, database exports, or report data. Chrome Web Store installation metrics remain the source of truth for total users; this service counts only consenting reporting installations.
