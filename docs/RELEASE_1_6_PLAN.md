# OTNow 1.6 release plan

Status: local 1.6.0 development candidate implemented October 12, 2026. It has not been pushed, deployed, submitted, or registered as the uninstall destination.

Target: November 2026, with school work taking priority. Reading week can be used for the evidence, design, and implementation work below, but it does not remove the release freeze or verification gates. If representative Canvas data is unavailable or the announcement classification is unreliable, ship the completed-items, onboarding, feedback, and support improvements without announcement classification rather than guessing.

## Release goal

Make announcement-like Canvas planner entries understandable and dismissible without weakening OTNow's local-first privacy model, correctly separate Canvas-declared discussion work from ordinary assignments, make completed work easier to review and restore, and improve the consent, feedback, support, and removal experience.

## Frozen 1.6 scope

### 1. Recognize announcements

- Collect sanitized examples of every Canvas planner response currently shown as a generic **Course item** but known to be an announcement.
- Record the fields that distinguish an announcement from an assignment, quiz, discussion, calendar event, or planner note.
- Extend `normalizeType()` only after those response shapes are known.
- Normalize verified announcement shapes to `type: "announcement"` and add the label **Announcement**.
- Preserve the current fallback to **Course item** when the evidence is ambiguous.
- Never reclassify an assignment or quiz solely because its title contains words such as “exam,” “quiz,” or “announcement.”
- When Canvas declares an assignment as a discussion submission through structured fields or its Canvas discussion URL, present it as a **Discussion**. Do not inspect assignment prose or guess from its title.

### 2. Filter and locally mark announcements read

- Add **Announcements** to the existing type filter and grouping counts.
- Add **Mark announcements read** only when at least one visible unread announcement exists.
- Respect the current course filter: **All courses** affects all currently loaded announcements; a selected course affects only that course.
- Treat “read” as an OTNow display preference stored locally. It does not delete content or change Canvas.
- Hide locally read announcements from the normal deadline list while leaving assignments, quizzes, discussions, events, and notes untouched.
- Offer one brief **Undo** action after a bulk change. Undo must restore the exact prior set, not simply mark every announcement unread.
- Remove the confirmation and Undo notice automatically after six seconds so read actions do not accumulate permanent status rows.
- Provide a discoverable way to show previously read announcements again so the action is reversible after the brief Undo period.

### 3. Support and uninstall route

- Publish a themed uninstall/support page with neutral copy, the existing feedback form, reinstall/help links, and the private vulnerability-reporting route.
- Ask for optional feedback without guilt, pressure, or implying that uninstalling removes Canvas data.
- Register the page with Chrome's uninstall URL only after the live route is verified.
- Keep security reports out of the general feedback form and public chats.

### 4. Support future development link

- Enable the already prepared validated Ko-fi link only after the canonical `https://ko-fi.com/...` URL is confirmed.
- Use the wording **Support future OTNow development**.
- Keep it at the bottom of extension pages, beside ordinary actions on the statistics site, and more visibly in the long GitHub README.
- Do not add a popup, onboarding step, donation gate, or feature restriction.

### 5. Make feedback reachable inside OTNow

- Add a persistent, low-emphasis **Feedback** link near the bottom of the side panel.
- Add a clearer **Send feedback** action in Insights beside the explanation of what stays local and what may be shared.
- Point both locations to the existing Google Form in a new tab; do not build a second form or collect written feedback inside the extension.
- State that bug reports and suggestions belong in the feedback form, while suspected vulnerabilities must use GitHub's private vulnerability-reporting route.
- Do not require anonymous statistics to be enabled before written feedback can be submitted.

### 6. Add a dedicated Completed view

- Add **Completed** as a top-level panel view rather than mixing finished items into the normal deadlines list through a Settings switch.
- Include Canvas-reported submitted, graded, pending-review, complete, or completed items, plus items manually checked off inside OTNow.
- Display the source of completion clearly: **Completed in Canvas** or **Checked off in OTNow**.
- Allow only OTNow manual check-offs to be restored to Deadlines. Canvas-reported completion is read-only because OTNow must not pretend it can reverse a Canvas submission or grade state.
- Preserve course filtering and provide a useful empty state when no completed items are available.
- Give Completed its own type filter plus **By due date** and **By type** grouping, while retaining the course filter.
- Keep the existing `manualDone` record and toggle path; migrate the interface without deleting prior manual check-offs.
- Remove the redundant **Show completed items** control from Settings after upgrade behavior is verified. A stored legacy value may remain harmlessly during migration.

### 7. Redesign the anonymous-statistics decision page

- Do not open a separate statistics tab during installation or block access to deadlines. Show a compact, non-blocking notification inside the normal panel the first time the student opens OTNow, after the browser's own permission prompts are finished.
- The notification offers **Review** and **Not now**. **Review** opens the full disclosure; only that disclosure offers **Share anonymous statistics**.
- Keep the full disclosure a compact consent form rather than a product showcase: a clear **Optional and off by default** label, short disclosure, privacy-policy link, and the two decisions.
- Match the disclosure to the dark statistics and uninstall pages, with the same restrained particle field and cursor-reactive wash. Keep the text surface calm and readable, and disable decorative motion when reduced motion is requested.
- Keep **Share anonymous statistics** and **Not now** equally understandable and immediately available. Do not use countdowns, preselection, guilt, deceptive colour contrast, or repeated prompts.
- Record a decision only after the student enables sharing or selects **Not now** in either location. **Not now** sends nothing and does not interrupt later opens.
- When sharing is off, keep a persistent **Review anonymous statistics** action in Insights so the student can reconsider without being prompted again.
- Preserve the privacy-policy link and provide a clear status before returning to OTNow after either choice.
- Meet keyboard, screen-reader, reduced-motion, high-contrast, 200% zoom, and narrow-window requirements.

### 8. Show the Chrome Web Store rating on the public statistics dashboard

- Keep the current statistics dashboard layout; add a compact, separately labelled **Chrome Web Store rating** row or card rather than redesigning the page.
- Display the Store average, rating count, official listing link, and **Last checked** date. Never combine the Store rating with OTNow's own first-party star responses or imply that they measure the same audience.
- The official Chrome Web Store API does not expose ratings or reviews. Use the existing once-daily Worker schedule to fetch the public listing, parse only the accessibility-labelled average and count, and persist the last successful value rather than scraping during dashboard requests.
- Seed the first value from a manually verified public listing. Every later refresh must validate bounds, retain the last known good value on failure, expose the check date, and fail without breaking the dashboard.
- If no verified Store value is configured, hide the row or mark it unavailable; never invent, round up, or silently reuse an undated rating.

### 9. Remove low-value personal Insights statistics

- Remove **Successful refreshes** and **Days used** from the extension's personal Insights page. They measure app activity rather than a useful student outcome and currently take attention away from meaningful signals.
- Keep **Deadlines organized**, **Changed dates caught**, **Reminders delivered**, and **Manual check-offs** because each explains a concrete benefit OTNow provided.
- Do not delete existing local counters during the 1.6 upgrade. Stop presenting the low-value counters in the interface so older installations upgrade without a risky storage migration.
- Keep the public statistics dashboard unchanged apart from the separately sourced Chrome Web Store rating; this cleanup applies to the personal extension Insights view.

## Reading-week research spike: match the active page theme

The requested behaviour is to sample the page beside OTNow and select light or dark mode to match it, especially when Brave displays two tabs in Split View and OTNow opens on the right.

This is a prototype and release decision, not yet frozen 1.6 scope:

- The current extension can read Ontario Tech Canvas because that origin is already allowlisted, but it cannot inspect arbitrary websites with its present permissions.
- A privacy-bounded prototype may use `activeTab` plus `scripting` to sample only the explicitly invoked active page's declared `color-scheme` and computed visible background colour.
- Never request `<all_urls>`, never inject a persistent content script on arbitrary sites, and never store or transmit page URLs, titles, colours, screenshots, or page content.
- Treat the result as a one-time best-effort theme choice when OTNow is opened. Continuous following across arbitrary tab changes would require broader access and is out of scope.
- Test Brave Split View directly. Brave treats the panes as independent tabs and allows their positions to be swapped, while the standard extension APIs identify the active tab but do not expose a dependable `rightmostPane` property. The feature must therefore say **Match active page**, not promise **Match rightmost pane**.
- Restricted browser pages, PDFs, extension pages, unavailable styles, transparent backgrounds, images, and misleading brand colours must fall back to the user's saved Light, Dark, or Follow system preference.
- If the prototype cannot identify the intended Brave pane consistently, adds an unacceptable permission boundary, or causes theme flicker, do not ship it in 1.6.

## Non-goals for 1.6

- Google Calendar or any OAuth permission.
- Firefox packaging.
- Course-weight inference or priority ranking.
- Syllabus or announcement text extraction for exam prediction.
- A phone app, OTNow account, or hosted personal calendar.
- Any new Canvas endpoint unless real announcement samples prove the existing planner response is insufficient and a separate review approves the permission and privacy impact.
- Continuous reading of arbitrary websites for theme changes or broad `<all_urls>` access.
- Per-request scraping of the Chrome Web Store page or reliance on an undocumented ratings endpoint.

## Current code map

- `src/canvas-client.js` reads the two allowlisted Canvas endpoints and sends planner items to the model.
- `src/canvas-model.js` normalizes item type, identity, due date, link, and completion state.
- `src/constants.js` owns labels, reminder defaults, and the currently blank Ko-fi URL.
- `src/view-model.js` owns type groups and counts.
- `panel/panel.js` renders filters, groups, items, and the prepared support link.
- `panel/panel.js` owns the non-blocking first-open statistics notification. `options/onboarding.html`, `options/onboarding.css`, `options/onboarding.js`, and `options/reactive-background.js` own the optional full disclosure and its restrained visual effects.
- `options/options.html` and `options/options.js` currently own the legacy **Show completed items** control.
- `stats-worker/src/dashboard-assets.js` owns the public dashboard presentation; `stats-worker/src/worker.js` and the D1 migration own the isolated daily Store-rating refresh and last-known-good value.
- `src/storage.js` owns local settings and user state.
- `src/background.js` owns synchronization and panel messages.
- `tests/canvas-model.test.mjs` is the first home for sanitized announcement fixtures and classification cases.

## Proposed local data design

Use a dedicated local record rather than overloading assignment completion:

```text
announcementRead = {
  "<stable planner item id>": "<ISO timestamp>"
}
```

- Reuse the normalized planner item ID already derived from Canvas type and `plannable_id`.
- Keep the state in `chrome.storage.local` and never include it in anonymous statistics.
- Prune keys that no longer correspond to loaded announcements after a bounded retention period so the record cannot grow forever.
- Add a storage helper and migration boundary; do not silently change the meaning of `manualDone`.
- Keep the short-lived bulk-undo snapshot in panel memory. Persist the resulting read map, not a permanent history of every click.

## User-interface behaviour

1. The type selector shows **Announcements (N)** when announcement items exist.
2. Selecting a course immediately scopes both the list and bulk action.
3. The bulk action states its scope, for example **Mark 4 announcements read** or **Mark 2 CSCN1234 announcements read**.
4. After activation, an inline status says what changed and offers **Undo**.
5. A small **Show read announcements** control lets the user recover older dismissed items later.
6. Empty states distinguish “no announcements returned,” “all announcements marked read,” and “no matches for this course.”
7. Keyboard focus moves to the status/Undo control after a bulk change and returns predictably after Undo.
8. **Completed** appears beside Deadlines, Courses, and Insights with its own count.
9. A manually completed item offers **Move back to Deadlines**; a Canvas-completed item explains that its status comes from Canvas and cannot be reversed in OTNow.
10. The bottom of the panel includes restrained **Feedback** and **Support future OTNow development** links only when their validated URLs are configured.
11. Deadline and Completed organization controls start expanded, can be collapsed independently, and remember that local preference. A new installation groups deadlines by date.

## Evidence and remaining gates

- Canvas's official Planner API documents `announcement` as an explicit `plannable_type`, and the signed-in Ontario Tech dashboard confirmed that the current dated notices render through Canvas discussion-topic links. The implementation classifies only that explicit type and never guesses from a title.
- Sanitized fixtures cover two Canvas-declared announcements, a normal discussion whose title contains “announcement,” and an ambiguous wiki-page item that must remain **Course item**.
- Canvas's official Assignment API documents `discussion_topic` as a submission type. The implementation also accepts a structured `discussion_topic_id` or an Ontario Tech Canvas `/discussion_topics/` link, while ordinary assignments remain assignments and title or description text is never used as evidence.
- The existing model continues to accept only dated planner entries. The live Ontario Tech examples were present in the dated To Do feed; undated announcements remain outside OTNow's current planner scope.
- The local key reuses Canvas's documented `plannable_type` plus `plannable_id`, producing stable IDs such as `announcement:<id>` without storing announcement text in the read-state record.
- Canonical Ko-fi URL.
- Deployment and verification of the new `/support` or `/uninstall` route before registering it with Chrome.
- A direct Brave Split View test confirming which tab receives temporary `activeTab` access when OTNow is opened from the toolbar.

## Verification matrix

### Classification

- Known announcement shapes normalize to `announcement`.
- Assignment, quiz, discussion, event, note, and ambiguous fixtures retain their existing types.
- Canvas-declared discussion assignments normalize to `discussion`; ordinary assignments and title-only lookalikes remain `assignment`.
- Missing or malformed IDs, dates, links, or context fail safely.
- Links remain restricted to the Ontario Tech Canvas origin.

### Read state and scope

- Marking read affects announcements only.
- A selected course never changes another course's announcements.
- All-courses scope changes the exact set shown in the confirmation.
- Undo restores the exact previous read map.
- The announcement confirmation and Undo notice disappear after six seconds without changing saved read state.
- Read state survives panel close, browser restart, sync, and offline-cache use.
- Removed/stale announcements are pruned without deleting unrelated local data.

### Completed view

- Open deadlines and completed items never appear in the wrong view or duplicate across both views.
- Existing manual check-offs survive the upgrade and can be moved back to Deadlines.
- Canvas-reported completion cannot be reversed by the interface.
- Course filtering and empty states work independently in the Completed view.
- Completed type filtering and both due-date and type grouping preserve the correct completion source and restore action.

### Consent and feedback

- Installation does not open an OTNow statistics tab, and the first side-panel open remains usable behind a compact statistics notification.
- The full disclosure opens only after **Review**, never as a mandatory screen.
- Both notification actions remain visible without scrolling at common desktop sizes, and the optional disclosure remains usable at 200% zoom.
- Declining sends nothing, returns to the panel, and does not trigger repeated prompts.
- When sharing is off, Insights continues to expose **Review anonymous statistics**.
- Enabling requests only the existing optional statistics origin and still shows the exact disclosure.
- Feedback opens the established Google Form without requiring statistics consent.
- Security-reporting guidance points to the private vulnerability route instead of the feedback form.
- Personal Insights no longer shows successful-refresh or days-used vanity counters, while the four outcome-oriented counters remain accurate.

### Public rating source

- The Chrome Web Store rating and OTNow's own anonymous rating are visibly labelled as separate sources.
- The Store value includes its rating count, official listing link, and last-checked date.
- A missing, invalid, or stale Store snapshot cannot break the dashboard or alter the first-party rating.

### Regression and release

- Existing deadline completion, moved-date detection, reminder, extension-date, course mute, statistics opt-in, and cache behaviour remain unchanged.
- Signed-in, signed-out, offline, stale-cache, first-run, upgrade, light, dark, force-dark, keyboard-only, reduced-motion, 360-pixel width, and 200% zoom checks pass.
- `npm test`, `npm run check`, `npm run smoke:extension`, store packaging, checksum generation, and exact-package smoke testing pass.
- Upgrade testing starts from the published 1.5.0 package with realistic local storage and verifies that no settings, manual check-offs, deadline adjustments, or cached items are lost.
- The manifest adds no permission or origin unless separately approved and documented.

## Four-week student-aware schedule

### Week 1 — evidence and scope freeze

- Capture and sanitize representative Canvas planner responses.
- Write failing classification tests from those fixtures.
- Confirm local read-state semantics and copy.
- Confirm the uninstall page and Ko-fi URLs, or explicitly move either blocked item out of 1.6.
- Confirm the compact notification and optional disclosure hierarchy before styling them; avoid a multi-section product showcase.
- Prototype active-page theme sampling in the development build only and record a ship/defer decision; do not let it block the release.
- Record the current Chrome Web Store average and rating count from the public listing as the dated initial snapshot, then verify the daily refresh parser against the real response.

### Week 2 — model and storage

- Add verified announcement normalization and labels.
- Add local read-state storage, pruning, and migration behaviour.
- Add unit coverage for classification, persistence, and course scoping.
- Add the Completed view using the existing Canvas status and `manualDone` boundary, then verify upgrade preservation.

### Week 3 — panel and routes

- Add the filter, course-aware bulk action, Undo, show-read control, and accessible status handling.
- Publish and verify the uninstall/support page.
- Enable the support link only if its canonical URL is known.
- Add the persistent feedback link and the Insights feedback action.
- Implement the non-blocking first-open statistics notification, optional dark disclosure, and persistent Insights recovery action.
- Remove the two low-value personal Insights cards without deleting their stored counters.
- Add the separately sourced Chrome Web Store rating row to the existing statistics dashboard without changing its overall design.

### Week 4 — freeze and release

- Stop adding features.
- Run the full verification matrix and upgrade test.
- Update privacy, store, support, README, changelog, and version references.
- Build and inspect the exact store ZIP before submission.
- Submit 1.6.0, monitor real feedback, and use 1.6.1 only for verified fixes.

## Release acceptance criteria

1. Real announcement fixtures are classified without title guessing.
2. Users can filter announcements and locally mark only the intended course scope read.
3. Undo and later recovery both work.
4. No assignment, quiz, discussion, event, or note is hidden by the new action.
5. No new permission is requested.
6. The uninstall/support route is live and neutral.
7. Ko-fi remains hidden if the canonical URL is still unknown.
8. All automated, accessibility, packaging, and 1.5.0 upgrade checks pass.
9. Completed items are separated from active deadlines and manual check-offs can be restored without changing Canvas-reported status.
10. Feedback is reachable from the panel and Insights without statistics consent.
11. The redesigned statistics decision remains neutral, accurate, responsive, and accessible.
12. Active-page theme matching ships only if the bounded prototype passes the permission and Brave Split View review; otherwise the existing manual and system choices remain.
13. The public dashboard identifies the Chrome Web Store rating, count, link, and check date separately from OTNow's own anonymous rating.
14. Personal Insights shows only outcome-oriented statistics and no longer spends space on successful refreshes or days used.
15. Canvas-declared discussion assignments appear as discussions without title guessing or changes to ordinary assignments.
16. Deadline organization can collapse, new installations default to date grouping, and Completed supports course, type, and due-date/type organization.

## Open blockers after local implementation

- Canonical Ko-fi URL.
- Live deployment and verification of the themed uninstall/support route.
- Brave Split View behaviour for temporary active-page access; this blocks only automatic page-theme matching, not the rest of 1.6.
- Continued availability of the public Chrome Web Store markup used by the isolated daily refresh; parser failure must retain the last known good value and cannot block the dashboard.

