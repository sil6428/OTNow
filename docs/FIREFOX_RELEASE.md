# Firefox release track

OTNow 1.6 uses the same feature source on Chrome and Firefox. The Firefox-only boundary is `manifest.firefox.json` plus the packaging script; do not copy application code into a Firefox fork.

## Browser differences

- Chrome uses `side_panel` and a service worker. Firefox uses `sidebar_action` and a Manifest V3 background event page.
- `src/browser-api.js` selects Firefox's promise-based `browser` namespace or Chrome's `chrome` namespace.
- Firefox 142+ is required so Mozilla's built-in data-collection permission model is available.
- Required data collection is declared as `none`. The optional anonymous aggregate report is declared as `technicalAndInteraction`, remains off in OTNow, and still requires the student's explicit OTNow choice plus the optional Worker origin.
- AMO builds use Mozilla-managed updates and contain no GitHub update host permission.

## Local validation

Run:

```text
npm test
npm run check
npm run check:firefox
npm run package:firefox
```

Validate the extracted `dist/otnow-firefox-1.6.0.zip` with Mozilla's current `web-ext lint --warnings-as-errors`. The final result must contain zero errors, notices, and warnings.

For a temporary browser test:

1. Use Firefox 142 or newer and open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Extract the Firefox ZIP and select its root `manifest.json`.
4. Confirm that the OTNow toolbar action opens the native Firefox sidebar.
5. Test a signed-in Canvas sync, a signed-out recovery, local completion, an announcement read/unread action, settings persistence, and a notification.
6. Review anonymous statistics, decline once, then test enable and disable. Confirm the Worker permission is optional, Firefox's technical-and-interaction-data consent is shown, disabling deletes the aggregate row, and normal deadlines work throughout.
7. Restart the browser and repeat the persistence and scheduled-sync checks with the signed candidate when available; temporary add-ons do not represent final restart behaviour.

## AMO submission

- Upload the exact Firefox ZIP produced by `npm run package:firefox`.
- Provide the public privacy-policy URL and describe the Canvas course/planner reads, local storage, optional numeric report, Cloudflare Worker, and deletion flow exactly as implemented.
- State that Canvas names, codes, titles, links, dates, grades, credentials, tokens, and browsing history are never sent to OTNow's statistics service.
- Include reviewer instructions for an Ontario Tech authenticated Canvas test, or explain if reviewer access cannot be supplied and provide sanitized evidence.
- Do not add the Firefox Add-ons button or announce availability until the listing URL is real and the signed package installs.

Mozilla review timing must not cause Chrome 1.6 to ship untested. If the 1,000-item milestone arrives first, Chrome may release after its own gates while Firefox remains accurately described as submitted, pending, or in development.
