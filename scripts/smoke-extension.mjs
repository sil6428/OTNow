import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error("Set CODEX_NODE_MODULES to the bundled Node modules directory.");
const { chromium } = require(resolve(modules, "playwright"));

const root = resolve(process.env.OTNOW_EXTENSION_ROOT || resolve(import.meta.dirname, ".."));
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
  if (onboarding.heading !== "Choose whether to share anonymous totals." || !onboarding.share || !onboarding.decline || onboarding.status) {
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

  await page.evaluate(async () => {
    const dueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const base = {
      courseId: "42",
      courseCode: "TEST 1000",
      courseName: "Sanitized test course",
      color: "#0077ca",
      dueAt,
      moved: null,
      canvasComplete: false,
      deadlineAdjusted: false,
    };
    await chrome.storage.local.set({
      announcementRead: {},
      manualDone: { "note:4": true },
      state: {
        status: "ready",
        items: [
          { ...base, id: "announcement:1", canvasId: "1", title: "Sanitized notice", type: "announcement", url: "https://learn.ontariotechu.ca/courses/42/discussion_topics/1", status: "open", submitted: false, manuallyComplete: false },
          { ...base, id: "assignment:2", canvasId: "2", title: "Sanitized assignment", type: "assignment", url: "https://learn.ontariotechu.ca/courses/42/assignments/2", status: "open", submitted: false, manuallyComplete: false },
          { ...base, id: "assignment:3", canvasId: "3", title: "Submitted item", type: "assignment", url: "https://learn.ontariotechu.ca/courses/42/assignments/3", status: "submitted", submitted: true, manuallyComplete: false },
          { ...base, id: "note:4", canvasId: "4", title: "Local check-off", type: "note", url: "https://learn.ontariotechu.ca", status: "done", submitted: false, manuallyComplete: true },
        ],
        courses: [{ id: "42", code: "TEST 1000", name: "Sanitized test course", color: "#0077ca" }],
        lastSyncAt: new Date().toISOString(),
        firstSyncComplete: true,
        metrics: {
          deadlinesDiscovered: 4,
          movedDeadlinesDetected: 1,
          remindersSent: 2,
          manualCompletions: 1,
          successfulSyncs: 99,
          activeDays: ["2026-10-12"],
        },
      },
    });
    localStorage.removeItem("otnow:view");
  });

  await page.goto(`chrome-extension://${extensionId}/panel/panel.html`);
  await page.waitForSelector(".view-tabs");
  const initialPanel = await page.locator("#app").innerText();
  if (!initialPanel.includes("Announcements") || !initialPanel.includes("Mark 1 announcement read")) {
    throw new Error("Announcement controls are missing from the deadline view.");
  }
  await page.getByRole("button", { name: "Mark 1 announcement read" }).click();
  await page.waitForSelector("[data-announcement-status]");
  const markedRead = await page.evaluate(async () => (await chrome.storage.local.get("announcementRead")).announcementRead);
  if (!markedRead?.["announcement:1"]) throw new Error("Announcement read state was not saved locally.");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForFunction(async () => !((await chrome.storage.local.get("announcementRead")).announcementRead?.["announcement:1"]));
  await page.getByRole("button", { name: "Mark Sanitized notice read" }).click();
  await page.getByRole("button", { name: "Show 1 read announcement" }).click();
  await page.waitForFunction(() => document.querySelector("#app")?.innerText.includes("Read in OTNow"));
  await page.getByRole("button", { name: "Mark Sanitized notice unread" }).click();
  await page.waitForFunction(async () => !((await chrome.storage.local.get("announcementRead")).announcementRead?.["announcement:1"]));

  await page.getByRole("button", { name: /Completed/ }).click();
  const completedPanel = await page.locator("#app").innerText();
  if (!completedPanel.includes("Completed in Canvas") || !completedPanel.includes("Checked off in OTNow")) {
    throw new Error("Completed view does not distinguish Canvas and local completion.");
  }
  if ((completedPanel.match(/Move back to Deadlines/g) || []).length !== 1) {
    throw new Error("Only OTNow manual check-offs should be restorable.");
  }

  await page.getByRole("button", { name: "Insights" }).click();
  const insightsPanel = await page.locator("#app").innerText();
  if (insightsPanel.includes("Successful refreshes") || insightsPanel.includes("Days used")) {
    throw new Error("Low-value personal Insights metrics are still visible.");
  }
  const feedbackHref = await page.locator("#feedback-link").getAttribute("href");
  if (!feedbackHref?.startsWith("https://docs.google.com/forms/")) throw new Error("Panel feedback link is not configured.");

  if (errors.length) throw new Error(`Extension page errors: ${errors.join("; ")}`);
  console.log(JSON.stringify({
    ok: true,
    extensionId,
    ...snapshot,
    onboarding,
    declineVerified: true,
    announcementsVerified: true,
    completedVerified: true,
    insightsVerified: true,
  }));
} finally {
  if (context) await context.close();
  const absoluteProfile = resolve(profile);
  const absoluteTemp = resolve(tmpdir());
  if (!absoluteProfile.startsWith(`${absoluteTemp}\\`) || !absoluteProfile.includes("otnow-smoke-")) {
    throw new Error("Refusing to remove an unexpected browser profile path.");
  }
  await rm(absoluteProfile, { recursive: true, force: true });
}
