# Chrome Web Store permission justifications

These answers are written for the Chrome Web Store privacy and permissions review.

## Single purpose

OTNow displays Ontario Tech Canvas deadlines and sends student-configured deadline reminders.

## `sidePanel`

Required to keep the deadline list visible beside any browser tab without replacing or modifying the Canvas interface.

## `storage`

Required to save the last successful Canvas read for offline viewing, user reminder preferences, manual check-offs, due-date-change history, reminder deduplication records, counters displayed in the local Insights view, and the optional anonymous-statistics consent state and random installation identifier. Coursework remains in the local Chrome profile.

## `alarms`

Required to refresh Canvas periodically and check whether a configured deadline reminder should be displayed while Chrome is running.

## `notifications`

Required to show the deadline and changed-due-date notifications explicitly configured by the student.

## Host access: `https://learn.ontariotechu.ca/*`

Required to make read-only requests to the institution's Canvas Courses and Planner endpoints using the student's existing signed-in session.

## Host access: `https://raw.githubusercontent.com/*`

Required to retrieve the public OTNow `manifest.json` and compare its version number with the installed extension. No Canvas data, settings, credentials, or user identifier are included in this request. The downloaded JSON is treated only as data and is never executed.

This permission exists only in the manually installed GitHub release. The Chrome Web Store package removes the permission and disables the manual version check because Chrome provides automatic store updates. Do not enter this justification in the Web Store dashboard.

## Optional host access: `https://otnow-stats.sil6428-archtech.workers.dev/*`

This permission is not granted during installation. Chrome displays a separate permission request only after the student turns on **Help measure OTNow** in Settings. It permits one anonymous numerical usage report per day and a deletion request when the student opts out. Reports contain only a random installation identifier, extension version, and cumulative numeric totals. They never contain names, course names or codes, coursework titles, URLs, due dates, grades, email addresses, student numbers, Canvas identifiers, passwords, or authentication data.

## Remote code

OTNow does not execute remote code. All JavaScript is included in the extension package, and there are no remotely hosted scripts, WebAssembly modules, or runtime-loaded packages. In the manually installed GitHub release, the update check reads a version string from a public JSON manifest and only displays a link to manual instructions. The store package disables that check.

## Data-use disclosure

OTNow handles website content consisting of Canvas course names, course codes, planner items, due dates, Canvas links, completion states, and the student's submission status for those items. This content is used only for the extension's visible deadline and reminder features and is stored locally. The optional aggregate report transmits counts derived from item categories, not the content itself.

For the Web Store form, disclose the optional collection of **user activity** and aggregated **website content** because numerical totals are derived from use of Canvas items. Explain that collection is opt-in, limited to the feature described above, and not used for advertising. OTNow does not collect authentication information, personally identifiable information, health information, financial information, personal communications, location, or web history outside Ontario Tech Canvas. The detailed activity totals shown to the student in Insights remain on that student's device.
