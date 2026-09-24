# Chrome Web Store permission justifications

These answers are written for the Chrome Web Store privacy and permissions review.

## Single purpose

OTNow displays Ontario Tech Canvas deadlines and sends student-configured deadline reminders.

## `sidePanel`

Required to keep the deadline list visible beside any browser tab without replacing or modifying the Canvas interface.

## `storage`

Required to save the last successful Canvas read for offline viewing, user reminder preferences, manual check-offs, due-date-change history, and reminder deduplication records. The data remains in the local Chrome profile.

## `alarms`

Required to refresh Canvas periodically and check whether a configured deadline reminder should be displayed while Chrome is running.

## `notifications`

Required to show the deadline and changed-due-date notifications explicitly configured by the student.

## Host access: `https://learn.ontariotechu.ca/*`

Required to make read-only requests to the institution's Canvas Courses and Planner endpoints using the student's existing signed-in session. The extension does not request access to any other website.

## Remote code

OTNow does not execute remote code. All JavaScript is included in the extension package, and there are no remotely hosted scripts, WebAssembly modules, or runtime-loaded packages.

## Data-use disclosure

OTNow handles website content consisting of Canvas course names, course codes, planner items, due dates, Canvas links, completion states, and the student's submission status for those items. This information is used only for the extension's visible deadline and reminder features. It is stored locally and is not transmitted to the developer or third parties.

OTNow does not collect authentication information, personally identifiable information, health information, financial information, personal communications, location, web history outside Ontario Tech Canvas, or user activity for analytics or advertising.
