import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error("Set CODEX_NODE_MODULES to the bundled Node modules directory.");
const { chromium } = require(resolve(modules, "playwright"));

const root = resolve(import.meta.dirname, "..");
const profile = await mkdtemp(resolve(tmpdir(), "otnow-smoke-"));
let context;

try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true,
    args: [
      `--disable-extensions-except=${root}`,
      `--load-extension=${root}`,
    ],
  });

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`chrome-extension://${extensionId}/options/options.html`);
  await page.waitForSelector("#anonymous-stats");

  const snapshot = await page.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "options:get" });
    return {
      title: document.title,
      disclosure: document.querySelector(".disclosure")?.innerText || "",
      sharingEnabled: response.settings.shareAnonymousStats,
      optionalPermissionGranted: await chrome.permissions.contains({
        origins: ["https://otnow-stats.sil6428-archtech.workers.dev/*"],
      }),
    };
  });

  if (snapshot.sharingEnabled) throw new Error("Anonymous statistics must be off by default.");
  if (snapshot.optionalPermissionGranted) throw new Error("Statistics host access must not be granted at installation.");
  for (const expected of ["randomly generated installation ID", "Never sent", "course names", "student numbers"]) {
    if (!snapshot.disclosure.includes(expected)) throw new Error(`Settings disclosure is missing: ${expected}`);
  }

  if (errors.length) throw new Error(`Options page errors: ${errors.join("; ")}`);
  await page.goto(`chrome-extension://${extensionId}/options/onboarding.html`);
  const onboarding = await page.evaluate(() => ({
    heading: document.querySelector("h1")?.textContent,
    share: document.querySelector("#share")?.textContent,
    decline: document.querySelector("#decline")?.textContent,
    status: document.querySelector("#status")?.textContent,
  }));
  if (onboarding.heading !== "Help improve OTNow?" || !onboarding.share || !onboarding.decline || onboarding.status) {
    throw new Error("First-run consent screen is incomplete or preselected.");
  }
  await page.locator("#decline").click();
  await page.waitForFunction(() => document.querySelector("#status")?.textContent.includes("Nothing was shared"));
  const declined = await page.evaluate(async () => ({
    settings: (await chrome.runtime.sendMessage({ type: "options:get" })).settings,
    permission: await chrome.permissions.contains({
      origins: ["https://otnow-stats.sil6428-archtech.workers.dev/*"],
    }),
  }));
  if (!declined.settings.statsOnboardingSeen || declined.settings.shareAnonymousStats || declined.permission) {
    throw new Error("Declining first-run statistics did not preserve the privacy-first defaults.");
  }
  console.log(JSON.stringify({ ok: true, extensionId, ...snapshot, onboarding, declineVerified: true }));
} finally {
  if (context) await context.close();
  const absoluteProfile = resolve(profile);
  const absoluteTemp = resolve(tmpdir());
  if (!absoluteProfile.startsWith(`${absoluteTemp}\\`) || !absoluteProfile.includes("otnow-smoke-")) {
    throw new Error("Refusing to remove an unexpected browser profile path.");
  }
  await rm(absoluteProfile, { recursive: true, force: true });
}
