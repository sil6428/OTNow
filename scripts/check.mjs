import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const packageMetadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const { CURRENT_RELEASE_NOTE, releaseMilestoneMessage, releasePromptMessage } = await import("../src/release-notes.js");

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.type, "module");
assert.equal(packageMetadata.version, manifest.version, "package.json and manifest.json versions must match");
assert.equal(CURRENT_RELEASE_NOTE.version, manifest.version, "The current release announcement must match the packaged version");
assert.match(CURRENT_RELEASE_NOTE.id, new RegExp(`^${manifest.version.replaceAll(".", "\\.")}(?:-|$)`), "The release announcement ID must be tied to the packaged version");
assert(CURRENT_RELEASE_NOTE.community.reportingInstallations > 0, "Release milestones must use a dated positive installation snapshot");
assert(CURRENT_RELEASE_NOTE.community.totalItems > 0, "Release milestones must use a dated positive item snapshot");
assert.match(releaseMilestoneMessage(), /installs are sharing anonymous stats/i, "Release milestones must not present opt-in installations as every user");
assert.match(releasePromptMessage(), /Canvas items organized/i, "The compact release prompt must state the measured outcome");
assert.deepEqual(manifest.host_permissions, [
  "https://learn.ontariotechu.ca/*",
  "https://raw.githubusercontent.com/*",
]);
assert.deepEqual(manifest.optional_host_permissions, [
  "https://otnow-stats.sil6428-archtech.workers.dev/*",
]);
assert(!manifest.host_permissions.some((origin) => origin.includes("otnow-stats")), "Anonymous statistics access must remain optional");
assert(!manifest.permissions.includes("cookies"), "OTNow must not request cookie access");
assert(!manifest.permissions.includes("webRequest"), "OTNow must not intercept general browsing");
assert(!manifest.permissions.includes("tabs"), "OTNow should rely on its narrow Canvas host permission, not broad tab access");

const requiredFiles = [
  manifest.background.service_worker,
  manifest.side_panel.default_path,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((script) => script.js),
  "icons/icon-128.png",
  "src/metrics.js",
  "src/global-stats.js",
  "src/deadline-adjustments.js",
  "src/announcement-read.js",
  "src/release-notes.js",
  "options/onboarding.html",
  "options/onboarding.js",
  "options/reactive-background.js",
  "options/changelog.html",
  "options/changelog.css",
  "options/changelog.js",
  "stats-worker/src/landing-assets.js",
  "stats-worker/src/support-assets.js",
];
await Promise.all(requiredFiles.map((file) => access(resolve(root, file), constants.R_OK)));

const bridge = await readFile(resolve(root, "src/content/canvas-bridge.js"), "utf8");
assert.match(bridge, /method:\s*"GET"/);
assert.doesNotMatch(bridge, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);

const constantsSource = await readFile(resolve(root, "src/constants.js"), "utf8");
const supportUrl = constantsSource.match(/export const SUPPORT_URL = "([^"]*)";/)?.[1];
assert.notEqual(supportUrl, undefined, "SUPPORT_URL must be declared");
if (supportUrl) {
  const parsedSupportUrl = new URL(supportUrl);
  assert.equal(parsedSupportUrl.protocol, "https:");
  assert.equal(parsedSupportUrl.hostname, "ko-fi.com");
}

const privacy = await readFile(resolve(root, "PRIVACY.md"), "utf8");
assert.match(privacy, /Insights/i, "Privacy policy must describe local Insights totals");
assert.match(privacy, /opt-in/i, "Privacy policy must describe opt-in anonymous statistics");

const globalStats = await readFile(resolve(root, "src/global-stats.js"), "utf8");
for (const forbidden of ["courseName", "courseCode", "assignmentTitle", "studentNumber", "email", "dueAt", "grade"]) {
  assert(!globalStats.includes(forbidden), `Anonymous report code must not reference ${forbidden}`);
}

await Promise.all([
  "stats-worker/src/worker.js",
  "stats-worker/schema.sql",
  "stats-worker/wrangler.jsonc",
].map((file) => access(resolve(root, file), constants.R_OK)));

for (const workflow of ["quality-checks.yml", "release.yml"]) {
  const source = await readFile(resolve(root, ".github", "workflows", workflow), "utf8");
  assert.doesNotMatch(source, /uses:\s*[^\s]+@v\d+/i, `${workflow} must not trust a movable action tag`);
  for (const line of source.split(/\r?\n/).filter((value) => value.includes("uses:"))) {
    assert.match(line, /@[0-9a-f]{40}\b/i, `${workflow} action dependencies must be pinned to a commit SHA`);
  }
}

const panelSource = await readFile(resolve(root, "panel/panel.js"), "utf8");
assert.match(panelSource, /renderInsights/, "Side panel must expose the local Insights view");
assert.match(panelSource, /renderCompleted/, "Side panel must expose a dedicated Completed view");
assert.match(panelSource, /panel:mark-announcements-read/, "Side panel must expose local announcement read controls");
assert.match(panelSource, /panel:set-deadline/, "Side panel must expose local deadline adjustments");
assert.doesNotMatch(panelSource, /insightRow\("Successful refreshes"/, "Personal Insights must not display refresh vanity metrics");
assert.doesNotMatch(panelSource, /insightRow\("Days used"/, "Personal Insights must not display active-day vanity metrics");
assert.match(panelSource, /Review anonymous statistics/, "Insights must keep anonymous statistics available after a decline");
assert.match(panelSource, /statistics-prompt/, "The first panel open must use a non-blocking statistics notification");
assert.match(panelSource, /statsOnboardingSeen/, "The statistics notification must stop after the user chooses or dismisses it");
assert.match(panelSource, /release-note-prompt/, "Version changes must use a one-time release announcement");
assert.match(panelSource, /renderSyncNotice/, "Stale cached data must expose a recovery notice");
assert.match(panelSource, /Copy troubleshooting info/, "Insights must expose privacy-safe troubleshooting information");
assert.match(panelSource, /Privacy check: This report contains no names/, "Troubleshooting information must state its privacy boundary");
assert.match(panelSource, /organizer\.append\(summary, controls, renderSearch\(view, searchLabel\)\)/, "Local search must live inside the Organize area");
assert.match(panelSource, /Clear filters/, "Filtered empty states must offer a one-click reset");
assert.match(panelSource, /What's new/, "Insights must keep the current release notes accessible");
assert.match(panelSource, /Chrome Web Store/, "Insights must link back to the official Store listing");

const backgroundSource = await readFile(resolve(root, "src/background.js"), "utf8");
assert.doesNotMatch(backgroundSource, /tabs\.create\(\{\s*url:\s*chrome\.runtime\.getURL\("options\/onboarding\.html"\)/, "Installation must not open the statistics choice before OTNow is used");
assert.doesNotMatch(backgroundSource, /stats:onboarding-opened/, "Viewing the consent screen alone must not record a choice");

const panelHtml = await readFile(resolve(root, "panel/panel.html"), "utf8");
assert.match(panelHtml, /id="feedback-link"/, "Side panel must expose the feedback form");
assert.match(panelHtml, /id="sync-status" tabindex="0"/, "The exact sync time must be keyboard accessible");

const optionsHtml = await readFile(resolve(root, "options/options.html"), "utf8");
assert.doesNotMatch(optionsHtml, /id="show-completed"/, "Completed work belongs in its dedicated view, not a Settings switch");

const onboarding = await readFile(resolve(root, "options/onboarding.html"), "utf8");
assert.match(onboarding, /Nothing is shared unless you choose to enable it/i);
assert.match(onboarding, /Optional and off by default/i);
assert.match(onboarding, /What stays local/i);
assert.match(onboarding, /Example report/i);
assert.match(onboarding, /Share anonymous statistics/i);
assert.match(onboarding, /Not now/i);
assert.match(onboarding, /View OTNow Stats/i);
assert.match(onboarding, /class="wash"/i, "Statistics disclosure must include the reactive background wash");
assert.match(onboarding, /id="field"/i, "Statistics disclosure must include the reactive background field");
assert.match(onboarding, /reactive-background\.js/i, "Statistics disclosure must load the reactive background");
assert.doesNotMatch(onboarding, /checked/i, "Statistics disclosure must not be preselected");

const changelogPage = await readFile(resolve(root, "options/changelog.html"), "utf8");
assert.match(changelogPage, /id="change-list"/i, "The detailed release announcement must list its changes");
assert.match(changelogPage, /Full project changelog/i, "The release announcement must link to older detailed notes");

console.log(`OTNow package check passed (${requiredFiles.length} required files).`);
