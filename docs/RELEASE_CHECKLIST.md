# OTNow release checklist

## Functionality

- [x] Extension loads as Manifest V3.
- [x] Toolbar action opens the side panel.
- [x] Ontario Tech Canvas session is recognized.
- [x] Active courses and planner items render.
- [x] Deadlines can be filtered and grouped by Canvas item type.
- [x] Courses directory opens official Canvas content sections.
- [x] Public repository version check detects a newer semantic version.
- [x] Update notice links to a separate step-by-step guide.
- [x] Manual refresh succeeds.
- [ ] Confirm a naturally submitted assignment becomes **Submitted**.
- [ ] Confirm a graded quiz becomes **Submitted**.
- [ ] Confirm a professor's real due-date change is detected.
- [ ] Confirm reminders fire at the configured time.
- [ ] Confirm a muted course does not create a reminder.
- [ ] Confirm cached deadlines remain visible while offline.
- [ ] Confirm sign-out produces the **Connect Canvas** screen and preserves a prior cache.

## Accessibility and interface

- [x] Keyboard-operable buttons, filters, links, and check-offs.
- [x] Visible focus uses Chrome's native button/link treatment.
- [x] Light, dark, and system themes with a one-click panel toggle.
- [x] Screen-reader labels on icon buttons and check-offs.
- [x] Test at a 360px-wide side panel.
- [ ] Test at 200% browser zoom.
- [ ] Run a screen-reader smoke test.

## Privacy and security

- [x] Host permissions are limited to Ontario Tech Canvas and GitHub's public raw-content origin.
- [x] GitHub host access is limited to the public raw-content origin used for the version manifest.
- [x] Canvas bridge accepts only allowlisted `/api/v1/courses` and `/api/v1/planner/items` paths.
- [x] Canvas network requests are hard-coded to `GET`.
- [x] No cookie, broad tab, web-request, scripting, or clipboard permission.
- [x] No analytics, ads, trackers, remote scripts, or external application server.
- [x] Local-data deletion control.
- [x] Incognito mode disabled.
- [ ] Publish the privacy policy at a stable HTTPS URL.

## Store submission

- [x] 128×128 icon.
- [x] Store description draft.
- [x] Permission justifications.
- [ ] Public GitHub repository and issue tracker.
- [ ] Public support URL.
- [ ] Public privacy-policy URL.
- [x] 1280×800 screenshot without real student information.
- [x] Course-directory screenshot without real student information.
- [x] Real-session screenshot sanitized with fictional course and coursework data.
- [ ] Optional 440×280 promotional tile.
- [ ] Create the Chrome Web Store developer account and pay Google's one-time registration fee.
- [ ] Upload the clean release ZIP.
- [ ] Complete data-use disclosures using `PERMISSION_JUSTIFICATIONS.md`.
