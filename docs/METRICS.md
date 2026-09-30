# Measuring OTNow responsibly

OTNow does not transmit student activity or course information. Product reach should be measured with the aggregate reports already supplied by the Chrome Web Store and GitHub, not with a new tracker inside the extension.

## Chrome Web Store dashboard

After OTNow is published, open the item in the Chrome Web Store Developer Dashboard and record these values monthly:

- daily installs and uninstalls;
- weekly users;
- store-listing impressions and page views;
- rating and review count;
- installation count by released version.

Google documents these reports at [Analyze your store listing metrics](https://developer.chrome.com/docs/webstore/metrics/). The reports can be exported as CSV. Google notes that the **Users** report measures installations and does not prove that every installation is actively using the extension, so public claims should retain the dashboard's wording.

The Store listing page can also opt in to the Chrome Web Store's managed Google Analytics property. This measures the public listing page and install conversion without adding Google Analytics code or permissions to OTNow. See [Use Google Analytics with the Chrome Web Store](https://developer.chrome.com/docs/webstore/google-analytics/).

## GitHub indicators

Use the repository's **Insights** pages to record:

- stars and forks;
- unique visitors and repository clones for the available reporting window;
- release downloads;
- issues opened and closed;
- outside contributors and merged pull requests.

GitHub traffic windows are limited, so export or record the numbers on a regular schedule if they will be used later.

## Monthly record

Store one dated row with the following fields:

```text
Month | Weekly users | New installs | Uninstalls | Listing views | Install conversion | Rating | Reviews | GitHub stars | Release downloads
```

Do not copy names, email addresses, course details, screenshots, or any student-level information into the record.

## Resume wording

Use only a number visible in an exported report or dated screenshot. Good patterns are:

- Built and published a privacy-first Chrome extension adopted by **X weekly users**, with **Y installs** and a **Z/5 rating**.
- Improved the Chrome Web Store listing to convert **X% of Y listing visits** into installs over a stated period.
- Maintained **X releases** with automated tests, packaged artifacts, checksums, and update documentation.
- Resolved **X user-reported issues** and shipped **Y feature releases** while keeping Canvas data local to the browser.

Avoid claiming aggregated deadlines, reminders, time saved, or active usage across all students. OTNow deliberately does not collect those numbers. The in-extension **Insights** page describes only the current Chrome profile and is for the student's own use.
