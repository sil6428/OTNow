# OTNow 1.6 release plan

Status: scope planning started October 11, 2026. No 1.6 feature code or version bump has been made yet.

Target: November 2026, with school work taking priority. If representative Canvas data is unavailable or the announcement classification is unreliable, ship the support/uninstall improvements as 1.5.x and delay the announcement feature rather than guessing.

## Release goal

Make announcement-like Canvas planner entries understandable and dismissible without weakening OTNow's local-first privacy model, then complete the support path around installation, feedback, and removal.

## Frozen 1.6 scope

### 1. Recognize announcements

- Collect sanitized examples of every Canvas planner response currently shown as a generic **Course item** but known to be an announcement.
- Record the fields that distinguish an announcement from an assignment, quiz, discussion, calendar event, or planner note.
- Extend `normalizeType()` only after those response shapes are known.
- Normalize verified announcement shapes to `type: "announcement"` and add the label **Announcement**.
- Preserve the current fallback to **Course item** when the evidence is ambiguous.
- Never reclassify an assignment or quiz solely because its title contains words such as “exam,” “quiz,” or “announcement.”

### 2. Filter and locally mark announcements read

- Add **Announcements** to the existing type filter and grouping counts.
- Add **Mark announcements read** only when at least one visible unread announcement exists.
- Respect the current course filter: **All courses** affects all currently loaded announcements; a selected course affects only that course.
- Treat “read” as an OTNow display preference stored locally. It does not delete content or change Canvas.
- Hide locally read announcements from the normal deadline list while leaving assignments, quizzes, discussions, events, and notes untouched.
- Offer one brief **Undo** action after a bulk change. Undo must restore the exact prior set, not simply mark every announcement unread.
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

## Non-goals for 1.6

- Google Calendar or any OAuth permission.
- Firefox packaging.
- Course-weight inference or priority ranking.
- Syllabus or announcement text extraction for exam prediction.
- A phone app, OTNow account, or hosted personal calendar.
- Any new Canvas endpoint unless real announcement samples prove the existing planner response is insufficient and a separate review approves the permission and privacy impact.

## Current code map

- `src/canvas-client.js` reads the two allowlisted Canvas endpoints and sends planner items to the model.
- `src/canvas-model.js` normalizes item type, identity, due date, link, and completion state.
- `src/constants.js` owns labels, reminder defaults, and the currently blank Ko-fi URL.
- `src/view-model.js` owns type groups and counts.
- `panel/panel.js` renders filters, groups, items, and the prepared support link.
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

## Required evidence before implementation

- At least two sanitized announcement response examples from Canvas, preferably from different courses.
- At least one generic course-item response that is not an announcement, to protect the fallback.
- Confirmation of whether announcement entries always include a due/plannable date. The current model intentionally drops undated items.
- Confirmation that the stable item ID remains the same across refreshes.
- Canonical Ko-fi URL.
- Final live URL for the uninstall/support page.

## Verification matrix

### Classification

- Known announcement shapes normalize to `announcement`.
- Assignment, quiz, discussion, event, note, and ambiguous fixtures retain their existing types.
- Missing or malformed IDs, dates, links, or context fail safely.
- Links remain restricted to the Ontario Tech Canvas origin.

### Read state and scope

- Marking read affects announcements only.
- A selected course never changes another course's announcements.
- All-courses scope changes the exact set shown in the confirmation.
- Undo restores the exact previous read map.
- Read state survives panel close, browser restart, sync, and offline-cache use.
- Removed/stale announcements are pruned without deleting unrelated local data.

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

### Week 2 — model and storage

- Add verified announcement normalization and labels.
- Add local read-state storage, pruning, and migration behaviour.
- Add unit coverage for classification, persistence, and course scoping.

### Week 3 — panel and routes

- Add the filter, course-aware bulk action, Undo, show-read control, and accessible status handling.
- Publish and verify the uninstall/support page.
- Enable the support link only if its canonical URL is known.

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

## Open blockers

- Representative sanitized Canvas announcement and non-announcement planner payloads.
- Canonical Ko-fi URL.
- Final location for the themed uninstall/support route.

