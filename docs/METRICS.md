# Measuring OTNow responsibly

OTNow uses two distinct measurement sources. Chrome Web Store reports remain authoritative for total installations and weekly users. A separate public dashboard summarizes only the students who explicitly opt in to anonymous numerical statistics.

## Public OTNow dashboard

Open `https://otnow-stats.sil6428-archtech.workers.dev/dashboard`. The read-only dashboard reports:

- reporting installations and active reporting installations over 1, 7, and 30 days;
- total Canvas items organized, broken down by general item type;
- reminders delivered, changed dates caught, manual check-offs, successful refreshes, and combined days used;
- extension-version distribution and new reporting installations over 30 days.

These are opt-in product totals, not student records. Always use the label **reporting installations** rather than **users** unless the Chrome Web Store report supplies the user number. Do not attempt to join these totals to Chrome Web Store, GitHub, school, account, or identity data.

## Chrome Web Store dashboard

After OTNow is published, open the item in the Chrome Web Store Developer Dashboard and record these values monthly:

- daily installs and uninstalls;
- weekly users;
- store-listing impressions and page views;
- rating and review count;
- installation count by released version.

Google documents these reports at [Analyze your store listing metrics](https://developer.chrome.com/docs/webstore/metrics/). The reports can be exported as CSV. Google's **Users** report measures installations and does not prove that every installation is actively using the extension, so public claims should retain the dashboard's wording.

The Store listing page can also opt in to the Chrome Web Store's managed Google Analytics property. This measures the public listing page and install conversion without adding Google Analytics code or permissions to OTNow. See [Use Google Analytics with the Chrome Web Store](https://developer.chrome.com/docs/webstore/google-analytics/).

## GitHub indicators

Use the repository's **Insights** pages to record stars, forks, unique visitors, repository clones, release downloads, issues, outside contributors, and merged pull requests. GitHub traffic windows are limited, so record the numbers regularly if they will be used later.

## Monthly record

Store one dated row with these fields:

```text
Month | CWS weekly users | New installs | Uninstalls | Listing views | Install conversion | Rating | Reviews | Reporting installations | Items organized | Reminders delivered | GitHub stars | Release downloads
```

Do not copy names, email addresses, course details, screenshots, or student-level information into the record.

## Resume wording

Use only a number visible in an exported report or dated screenshot. Accurate patterns include:

- Built and published a privacy-first Chrome extension adopted by **X Chrome Web Store weekly users**, with **Y installs** and a **Z/5 rating**.
- Organized **X dated Canvas items** across **Y consenting reporting installations**; explicitly state that the statistic is opt-in.
- Improved the Chrome Web Store listing to convert **X% of Y listing visits** into installs over a stated period.
- Maintained **X releases** with automated tests, packaged artifacts, checksums, and update documentation.
- Resolved **X user-reported issues** and shipped **Y feature releases** while keeping identifiable Canvas data local.

Do not present public-dashboard totals as all users, do not estimate time saved, and do not combine unlike reporting windows. The in-extension **Insights** page describes only the current Chrome profile; the public global dashboard includes only installations that opted in.
