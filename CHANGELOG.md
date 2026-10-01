# Changelog

## 1.2.0 — 2026-10-01

- Added a one-time first-run consent screen that explains anonymous global statistics before requesting access.
- Kept sharing off by default with no preselected choice; reports begin only after the student selects **Share anonymous statistics** and accepts Chrome's optional permission.
- Added an equally available **Not now** path that sends nothing and leaves the feature available later in Settings.

## 1.1.0 — 2026-09-30

- Added an optional, off-by-default anonymous global statistics program with a separate Chrome permission and a precise in-product disclosure.
- Added a private Cloudflare dashboard for reporting installations, aggregate item categories, reminders, date changes, refreshes, days used, versions, and 30-day growth.
- Added one-click opt-out and server deletion, hashed installation identifiers, daily reporting limits, and automatic 180-day expiry for inactive rows.
- Kept all course names, coursework titles, URLs, dates, grades, emails, student identifiers, Canvas identifiers, credentials, and detailed coursework on the student's device.
- Expanded automated checks to lock the anonymous payload schema and prevent identifying coursework fields from entering it.

## 1.0.0 — 2026-09-30

- Prepared the first stable Chrome Web Store release.
- Added a local-only Insights view for deadlines organized, changed dates detected, reminders delivered, manual check-offs, successful refreshes, and days used.
- Kept all activity totals on the student's device; no telemetry or analytics were added to the extension.
- Added a release workflow that tests, packages, checksums, and publishes tagged GitHub releases automatically.
- Simplified GitHub updates so users replace files in the same folder and select **Reload** without removing the extension or losing local settings.
- Added a measurement guide for using Chrome Web Store and GitHub aggregate statistics in accurate portfolio and resume claims.

## 0.5.2 — 2026-09-24

- Added a dedicated beginner installation guide with clear warnings against GitHub's nested source archives.
- Included the installation guide in packaged GitHub releases and added an automated check for the optional support URL.
- Prepared an unobtrusive support link below all side-panel content; it remains hidden until the official Ko-fi page is available.
- Recorded the WATnow creator's approval to publish OTNow while preserving the original MIT attribution.

## 0.5.1 — 2026-09-24

- Replaced the README preview with the final sanitized real-session image.
- Added beginner-proof release installation instructions and a warning against GitHub's nested source ZIP.
- Added a complete Chrome Web Store submission guide, live support/privacy URLs, and a 440×280 promotional tile.
- Clarified that Chrome Web Store installs update automatically while GitHub-installed copies use the manual update guide.
- Added a store-specific package that disables the manual GitHub updater and removes its host permission because Chrome handles store updates.

## 0.5.0 — 2026-09-24

- Added a six-hour public repository version check with no credentials or student-data transmission.
- Added an in-panel update notice that appears only when the repository contains a newer semantic version.
- Added a separate step-by-step guide for safely updating the same unpacked extension folder.
- Displayed the installed version in the panel footer and improved filter sizing at real side-panel widths.

## 0.4.1 — 2026-09-24

- Softened the panel to blend with Canvas using open lists, lighter dividers, natural title casing, and restrained course-colour dots.
- Replaced the outlined brand symbol and heavy row accents with subtler interface details.
- Reworked sanitized screenshots with generic course names, generic coursework, and non-identifying course artwork.

## 0.4.0 — 2026-09-24

- Reworked the panel into a compact, conventional utility layout without decorative dashboard cards.
- Added course and item-type filters with persistent grouping by type or due-date range.
- Kept assignments, quizzes, discussions, events, planner notes, and other dated items in distinct groups.
- Added a Courses directory linking to official Canvas homes, modules, assignments, quizzes, discussions, files, and grades.
- Added automated grouping coverage and refreshed the sanitized store screenshots.

## 0.3.0 — 2026-09-24

- Restyled the panel around Ontario Tech's official Future Blue, Simcoe Blue, Tech Tangerine, and neutral colours.
- Matched Canvas's flatter cards, compact blue navigation bar, square controls, and Lato-first typography.
- Added a persistent one-click light/dark theme toggle to the panel header.
- Migrated existing default-theme installs to the new Canvas-matching light appearance.
- Added a sanitized real-session project screenshot using fictional course and coursework data.

## 0.2.0 — 2026-09-24

- Confirmed the Canvas session bridge and side panel against Ontario Tech's live Canvas instance.
- Added per-course notification controls.
- Bounded notification-link history and pruned obsolete reminder records.
- Disabled incognito operation so course data is not duplicated into a private profile.
- Added Chrome Web Store submission and release documentation.

## 0.1.0 — 2026-09-24

- First working Ontario Tech Canvas build.
- Added course and planner reads, deadline grouping, completion detection, manual check-offs, moved-date detection, reminders, offline cache, themes, and course filters.
- Added a local-only privacy model, automated tests, and package checks.
