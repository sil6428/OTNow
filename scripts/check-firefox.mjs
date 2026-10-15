import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const chromeManifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "manifest.firefox.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, chromeManifest.version, "Chrome and Firefox builds must ship the same version");
assert.deepEqual(manifest.background.scripts, ["src/background.js"]);
assert.equal(manifest.background.type, "module");
assert.equal(manifest.sidebar_action.default_panel, "panel/panel.html");
assert.equal(manifest.sidebar_action.open_at_install, false, "Firefox must not open OTNow before the user asks");
assert(!("side_panel" in manifest), "Firefox must use sidebar_action, not Chrome side_panel");
assert(!manifest.permissions.includes("sidePanel"), "Firefox must not request Chrome's sidePanel permission");
assert(!manifest.host_permissions.some((origin) => origin.includes("raw.githubusercontent.com")), "AMO builds must use Firefox updates");
assert.deepEqual(manifest.host_permissions, ["https://learn.ontariotechu.ca/*"]);
assert.deepEqual(manifest.optional_host_permissions, ["https://otnow-stats.sil6428-archtech.workers.dev/*"]);

const gecko = manifest.browser_specific_settings?.gecko;
assert.match(gecko?.id || "", /@/);
assert(Number.parseInt(gecko?.strict_min_version, 10) >= 142, "Firefox 142+ gives desktop and Android the built-in data consent contract");
assert.deepEqual(gecko?.data_collection_permissions?.required, ["none"]);
assert.deepEqual(gecko?.data_collection_permissions?.optional, ["technicalAndInteraction"]);

const requiredFiles = [
  ...manifest.background.scripts,
  manifest.sidebar_action.default_panel,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((script) => script.js),
  "src/browser-api.js",
];
await Promise.all(requiredFiles.map((file) => access(resolve(root, file), constants.R_OK)));

for (const file of [
  "src/background.js",
  "src/storage.js",
  "src/canvas-client.js",
  "src/global-stats.js",
  "panel/panel.js",
  "options/options.js",
  "options/onboarding.js",
  "src/content/canvas-bridge.js",
]) {
  const source = await readFile(resolve(root, file), "utf8");
  assert.doesNotMatch(source, /\bchrome\./, `${file} must use the cross-browser API adapter`);
}

console.log(`OTNow Firefox check passed (${requiredFiles.length} required files).`);
