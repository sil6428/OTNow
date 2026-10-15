# Measuring OTNow responsibly

OTNow uses distinct measurement sources. Each official browser store remains authoritative for installations and active-use measures on that store. A separate public dashboard summarizes only the installations that explicitly opt in to anonymous numerical statistics.

## Public OTNow dashboard

Open `https://otnow-stats.sil6428-archtech.workers.dev/dashboard`. The read-only dashboard reports:

- reporting installations;
- the exact total of Canvas items organized;
- the optional community-rating average and response count.

These are opt-in product totals, not student records. The public response is cached for one hour, and writes never invalidate that cache. The dashboard shows exact values until a number becomes too wide for its card, then uses compact notation such as `100K`; hovering or focusing the value reveals the exact count. The public API does not expose recent-activity windows, version distribution, per-type coursework totals, installation history, identifiers, or individual rows. Always use the label **reporting installations** rather than **users** unless the Chrome Web Store report supplies the user number. Do not attempt to join these totals to Chrome Web Store, GitHub, school, account, or identity data.

## Chrome Web Store dashboard

Now that OTNow is published, open the item in the Chrome Web Store Developer Dashboard and record these values monthly:

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
Month | CWS weekly users | New installs | Uninstalls | Listing views | Install conversion | Rating | Reviews | Reporting installations | Items organized | GitHub stars | Release downloads
```

Do not copy names, email addresses, course details, screenshots, or student-level information into the record.

## Resume wording

Use only a number visible in an exported report or dated screenshot. Accurate patterns include:

- Built and published a privacy-first Chrome extension adopted by **X Chrome Web Store weekly users**, with **Y installs** and a **Z/5 rating**.
- Organized **X dated Canvas items** across **Y consenting reporting installations**; explicitly state that the statistic is opt-in and reflects only participating installations.
- Improved the Chrome Web Store listing to convert **X% of Y listing visits** into installs over a stated period.
- Maintained **X releases** with automated tests, packaged artifacts, checksums, and update documentation.
- Resolved **X user-reported issues** and shipped **Y feature releases** while keeping identifiable Canvas data local.

Do not present public-dashboard totals as all users, do not estimate time saved, and do not combine unlike reporting windows. If Chrome and Firefox store counts are added, label the result **browser-store installations**, not unique users, because one person can install both. The in-extension **Insights** page describes only the current browser profile; the public global dashboard includes only installations that opted in.
