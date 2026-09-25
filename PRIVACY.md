# OTNow Privacy Policy

Last updated: September 24, 2026

OTNow is an unofficial browser extension for Ontario Tech students. It is designed to operate locally and does not run an OTNow server.

## Information the extension reads

With the student's existing signed-in Canvas session, OTNow reads active course names and codes, dated planner items, due dates, Canvas links, planner completion states, and the current student's submission status for those items.

## How the information is used

The information is used only to display deadlines, preserve an offline cache, detect changed due dates, update the toolbar badge, and schedule reminders requested by the student.

## Storage and sharing

Course information, settings, manual check-offs, and reminder history are stored locally through Chrome extension storage. OTNow does not sell, share, transmit, or use this information for advertising, analytics, profiling, or model training. OTNow does not collect passwords or authentication tokens.

## Network access

OTNow connects to `https://learn.ontariotechu.ca` through read-only `GET` requests to Canvas course and planner endpoints. It does not modify course content or submit work.

Copies installed manually from GitHub retrieve OTNow's public `manifest.json` from `https://raw.githubusercontent.com` about every six hours to compare version numbers. This request uses no credentials and does not contain course information, settings, browsing history, or a user identifier. OTNow does not download or execute remote code. The Chrome Web Store package disables this request because Chrome supplies automatic extension updates.

## Retention and deletion

Saved information remains on the local Chrome profile until the student uses **Delete local OTNow data**, clears extension data, or removes the extension.

## Affiliation

OTNow is an independent student project and is not affiliated with or endorsed by Ontario Tech University or Instructure.

## Contact

General questions can be submitted through the [public OTNow issue tracker](https://github.com/sil6428/OTNow/issues). Do not include private course information, student identifiers, security-sensitive details, or screenshots containing personal data. Suspected vulnerabilities must be submitted through [GitHub's private vulnerability-reporting form](https://github.com/sil6428/OTNow/security/advisories/new), not a public issue.

OTNow's use of information obtained from Ontario Tech Canvas complies with the Chrome Web Store User Data Policy, including its Limited Use requirements. The information is used only to provide and improve OTNow's visible deadline and reminder features.
