import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.type, "module");
assert.deepEqual(manifest.host_permissions, [
  "https://learn.ontariotechu.ca/*",
  "https://raw.githubusercontent.com/*",
]);
assert(!manifest.permissions.includes("cookies"), "OTNow must not request cookie access");
assert(!manifest.permissions.includes("webRequest"), "OTNow must not intercept general browsing");
assert(!manifest.permissions.includes("tabs"), "OTNow should rely on its narrow Canvas host permission, not broad tab access");

const requiredFiles = [
  manifest.background.service_worker,
  manifest.side_panel.default_path,
  manifest.options_page,
  ...manifest.content_scripts.flatMap((script) => script.js),
  "icons/icon-128.png",
];
await Promise.all(requiredFiles.map((file) => access(resolve(root, file), constants.R_OK)));

const bridge = await readFile(resolve(root, "src/content/canvas-bridge.js"), "utf8");
assert.match(bridge, /method:\s*"GET"/);
assert.doesNotMatch(bridge, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);

console.log(`OTNow package check passed (${requiredFiles.length} required files).`);
