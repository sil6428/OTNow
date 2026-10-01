import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const packageMetadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.type, "module");
assert.equal(packageMetadata.version, manifest.version, "package.json and manifest.json versions must match");
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
  "options/onboarding.html",
  "options/onboarding.js",
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

const panelSource = await readFile(resolve(root, "panel/panel.js"), "utf8");
assert.match(panelSource, /renderInsights/, "Side panel must expose the local Insights view");

const onboarding = await readFile(resolve(root, "options/onboarding.html"), "utf8");
assert.match(onboarding, /Nothing is shared unless you choose to enable it/i);
assert.match(onboarding, /Share anonymous statistics/i);
assert.match(onboarding, /Not now/i);
assert.match(onboarding, /View OTNow - Stats/i);
assert.doesNotMatch(onboarding, /checked/i, "First-run consent must not be preselected");

console.log(`OTNow package check passed (${requiredFiles.length} required files).`);
