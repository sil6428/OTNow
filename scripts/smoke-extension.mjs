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
  if (context.pages().some((candidate) => candidate !== page && candidate.url().includes("/options/onboarding.html"))) {
    throw new Error("Installation opened the anonymous statistics choice before OTNow was used.");
  }
  await page.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "options:get" });
    await chrome.storage.local.set({
      releaseNoteSeen: "",
      state: {
        ...response.state,
        status: "ready",
        items: [],
        courses: [],
        lastSyncAt: new Date().toISOString(),
        firstSyncComplete: true,
      },
    });
  });

  if (errors.length) throw new Error(`Options page errors: ${errors.join("; ")}`);
  await page.goto(`chrome-extension://${extensionId}/panel/panel.html`);
  await page.waitForSelector(".view-tabs");
  if (!page.url().endsWith("/panel/panel.html")) throw new Error("The optional statistics prompt blocked the main OTNow panel.");
  const promptText = await page.locator(".statistics-prompt").innerText();
  if (!promptText.includes("Optional anonymous statistics") || !promptText.includes("Nothing is shared")) {
    throw new Error("The non-blocking anonymous statistics notification is incomplete.");
  }
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.waitForURL(`chrome-extension://${extensionId}/options/onboarding.html?source=panel`);
  const onboarding = await page.evaluate(() => ({
    heading: document.querySelector("h1")?.textContent,
    share: document.querySelector("#share")?.textContent,
    decline: document.querySelector("#decline")?.textContent,
    status: document.querySelector("#status")?.textContent,
    reactiveWash: Boolean(document.querySelector(".wash")),
  }));
  if (onboarding.heading !== "Help improve OTNow?" || !onboarding.share || !onboarding.decline || onboarding.status || !onboarding.reactiveWash) {
    throw new Error("Optional statistics disclosure is incomplete or preselected.");
  }
  await page.mouse.move(140, 180);
  const pointerPosition = await page.evaluate(() => ({
    x: document.documentElement.style.getPropertyValue("--x"),
    y: document.documentElement.style.getPropertyValue("--y"),
  }));
  if (pointerPosition.x !== "140px" || pointerPosition.y !== "180px") {
    throw new Error("Statistics disclosure background is not reacting to the pointer.");
  }
  await page.locator("#decline").click();
  await page.waitForURL(`chrome-extension://${extensionId}/panel/panel.html`);
  const declined = await page.evaluate(async () => ({
    settings: (await chrome.runtime.sendMessage({ type: "options:get" })).settings,
    permission: await chrome.permissions.contains({
      origins: ["https://otnow-stats.sil6428-archtech.workers.dev/*"],
    }),
  }));
  if (!declined.settings.statsOnboardingSeen || declined.settings.shareAnonymousStats || declined.permission) {
    throw new Error("Declining optional statistics did not preserve the privacy-first defaults.");
  }
  const releasePrompt = await page.locator(".release-note-prompt").innerText();
  if (!releasePrompt.includes("Thanks for supporting OTNow") || !releasePrompt.includes("781 Canvas items") || !releasePrompt.includes("See changes")) {
    throw new Error("The one-time release announcement is missing or unclear.");
  }
  const releasePromptLayout = await page.locator(".release-note-prompt").evaluate((prompt) => ({
    direction: getComputedStyle(prompt).flexDirection,
    titleSize: Number.parseFloat(getComputedStyle(prompt.querySelector("strong")).fontSize),
    bodySize: Number.parseFloat(getComputedStyle(prompt.querySelector("span")).fontSize),
  }));
  if (releasePromptLayout.direction !== "column" || releasePromptLayout.titleSize < 13 || releasePromptLayout.bodySize < 11) {
    throw new Error(`The release announcement is too cramped or small: ${JSON.stringify(releasePromptLayout)}`);
  }
  await page.getByRole("button", { name: "See changes", exact: true }).click();
  await page.waitForURL(`chrome-extension://${extensionId}/options/changelog.html?source=panel`);
  const changelogPage = await page.evaluate(() => ({
    heading: document.querySelector("h1")?.textContent,
    community: document.querySelector("#community-message")?.textContent,
    summary: document.querySelector("#release-summary")?.textContent,
    changes: document.querySelectorAll("#change-list li").length,
  }));
  if (!changelogPage.heading?.includes("supporting OTNow") || !changelogPage.community?.includes("keep spreading the word") || !changelogPage.summary || changelogPage.changes < 4) {
    throw new Error("The detailed release announcement page is incomplete.");
  }
  await page.locator("a.back").click();
  await page.waitForURL(`chrome-extension://${extensionId}/panel/panel.html`);
  if (await page.locator(".release-note-prompt").count()) throw new Error("The acknowledged release announcement appeared again.");

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
    localStorage.removeItem("otnow:group");
    localStorage.removeItem("otnow:completed-group");
    localStorage.removeItem("otnow:completed-type");
    localStorage.removeItem("otnow:organizer-open:deadlines");
    localStorage.removeItem("otnow:organizer-open:completed");
  });

  await page.goto(`chrome-extension://${extensionId}/panel/panel.html`);
  await page.waitForSelector(".view-tabs");
  const deadlineOrganizer = page.locator("details.organizer");
  const deadlineGroup = deadlineOrganizer.locator(".control").nth(2).locator("select");
  if (!(await deadlineOrganizer.evaluate((node) => node.open))) throw new Error("Deadline organization should start expanded.");
  if (await deadlineGroup.inputValue() !== "date") throw new Error("Fresh installs should group deadlines by date.");
  await deadlineOrganizer.locator("summary").click();
  if (await deadlineOrganizer.evaluate((node) => node.open)) throw new Error("Deadline organization could not be collapsed.");
  await deadlineOrganizer.locator("summary").click();
  const initialPanel = await page.locator("#app").innerText();
  if (!initialPanel.includes("Announcements") || !initialPanel.includes("Mark 1 announcement read")) {
    throw new Error("Announcement controls are missing from the deadline view.");
  }

  await page.getByRole("button", { name: /Search deadlines/ }).click();
  const deadlineSearch = page.locator('[data-search-view="deadlines"]');
  await deadlineSearch.fill("Sanitized assignment");
  await deadlineSearch.press("Enter");
  const searchedDeadlineTitles = await page.locator(".item-title").allInnerTexts();
  if (searchedDeadlineTitles.length !== 1 || searchedDeadlineTitles[0] !== "Sanitized assignment") {
    throw new Error(`Deadline search did not isolate the matching local item: ${JSON.stringify(searchedDeadlineTitles)}`);
  }
  await page.locator('[data-search-view="deadlines"]').fill("No result should match");
  await page.locator('[data-search-view="deadlines"]').press("Enter");
  if (!await page.getByRole("button", { name: "Clear filters", exact: true }).count()) {
    throw new Error("An empty deadline search does not offer a one-click filter reset.");
  }
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  if (!(await page.locator("#app").innerText()).includes("Mark 1 announcement read")) {
    throw new Error("Clearing deadline filters did not restore the full local list.");
  }

  await page.getByRole("button", { name: "Mark 1 announcement read" }).click();
  await page.waitForSelector("[data-announcement-status]");
  const markedRead = await page.evaluate(async () => (await chrome.storage.local.get("announcementRead")).announcementRead);
  if (!markedRead?.["announcement:1"]) throw new Error("Announcement read state was not saved locally.");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForFunction(async () => !((await chrome.storage.local.get("announcementRead")).announcementRead?.["announcement:1"]));
  await page.getByRole("button", { name: "Mark Sanitized notice read" }).click();
  await page.waitForSelector("[data-announcement-status]");
  await page.waitForSelector("[data-announcement-status]", { state: "detached", timeout: 8_000 });
  if (await page.locator(".announcement-actions").count()) throw new Error("The announcement panel remained after every announcement was read.");
  if ((await page.locator("#app").innerText()).includes("Sanitized notice")) throw new Error("A read announcement remained in Deadlines.");

  await page.getByRole("button", { name: /Completed/ }).click();
  const completedOrganizer = page.locator("details.organizer");
  const completedType = completedOrganizer.locator(".control").nth(1).locator("select");
  const completedGroup = completedOrganizer.locator(".control").nth(2).locator("select");
  if (!(await completedOrganizer.evaluate((node) => node.open))) throw new Error("Completed organization should start expanded.");
  if (await completedOrganizer.locator("select").count() !== 3) throw new Error("Completed view is missing course, type, or grouping controls.");
  if (await completedGroup.inputValue() !== "date") throw new Error("Completed work should default to due-date grouping.");
  await completedType.selectOption("note");
  const filteredCompleted = await page.locator("#app").innerText();
  if (!filteredCompleted.includes("Local check-off") || filteredCompleted.includes("Submitted item")) {
    throw new Error("Completed type filtering did not isolate the requested item type.");
  }
  await completedOrganizer.locator(".control").nth(1).locator("select").selectOption("all");
  await completedOrganizer.locator(".control").nth(2).locator("select").selectOption("type");
  await page.getByRole("button", { name: /Search completed items/ }).click();
  await page.locator('[data-search-view="completed"]').fill("Local check-off");
  await page.locator('[data-search-view="completed"]').press("Enter");
  const searchedCompletedTitles = await page.locator(".item-title").allInnerTexts();
  if (searchedCompletedTitles.length !== 1 || searchedCompletedTitles[0] !== "Local check-off") {
    throw new Error(`Completed search did not isolate the matching local item: ${JSON.stringify(searchedCompletedTitles)}`);
  }
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  const completedPanel = await page.locator("#app").innerText();
  if (!completedPanel.includes("Sanitized notice") || !completedPanel.includes("Read in OTNow") || !completedPanel.includes("Mark unread")) {
    throw new Error("Read announcements are not recoverable from Completed.");
  }
  if (!completedPanel.includes("Completed in Canvas") || !completedPanel.includes("Checked off in OTNow")) {
    throw new Error("Completed view does not distinguish Canvas and local completion.");
  }
  if ((completedPanel.match(/Move back to Deadlines/g) || []).length !== 1) {
    throw new Error("Only OTNow manual check-offs should be restorable.");
  }
  await page.getByRole("button", { name: "Mark unread", exact: true }).click();
  await page.waitForFunction(async () => !((await chrome.storage.local.get("announcementRead")).announcementRead?.["announcement:1"]));
  if ((await page.locator("#app").innerText()).includes("Sanitized notice")) throw new Error("Mark unread did not remove the announcement from Completed.");

  await page.evaluate(async () => {
    const { state } = await chrome.storage.local.get("state");
    await chrome.storage.local.set({
      state: {
        ...state,
        status: "ready",
        stale: { at: new Date().toISOString(), kind: "signed-out" },
        errorKind: "signed-out",
        lastSyncAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    });
  });
  await page.waitForSelector(".sync-warning-copy");
  const syncWarning = await page.locator("#notice").innerText();
  if (!syncWarning.includes("Canvas needs to be reconnected") || !syncWarning.includes("Last successful sync")) {
    throw new Error("Stale signed-out data does not explain how to reconnect Canvas.");
  }
  if (!await page.getByRole("button", { name: "Open Canvas", exact: true }).count()
    || !await page.getByRole("button", { name: "Try again", exact: true }).count()) {
    throw new Error("The stale-data notice is missing its recovery actions.");
  }
  if (!await page.locator("#sync-status").getAttribute("title")) {
    throw new Error("The sync footer does not expose the exact successful sync time on hover.");
  }
  await page.evaluate(async () => {
    const { state } = await chrome.storage.local.get("state");
    await chrome.storage.local.set({
      state: {
        ...state,
        stale: null,
        errorKind: null,
        lastSyncAt: new Date().toISOString(),
      },
    });
  });
  await page.waitForSelector("#notice", { state: "hidden" });

  await page.getByRole("button", { name: "Insights" }).click();
  const insightsPanel = await page.locator("#app").innerText();
  if (insightsPanel.includes("Successful refreshes") || insightsPanel.includes("Days used")) {
    throw new Error("Low-value personal Insights metrics are still visible.");
  }
  if (!insightsPanel.includes("Review anonymous statistics")) {
    throw new Error("Insights does not preserve the anonymous statistics opt-in after a decline.");
  }
  for (const expected of ["Troubleshooting and feedback", "Copy troubleshooting info", "What's new", "Chrome Web Store"]) {
    if (!insightsPanel.includes(expected)) throw new Error(`Insights is missing its completeness action: ${expected}`);
  }
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value) => {
          window.__copiedDiagnostic = value;
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy troubleshooting info", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".diagnostic-status")?.textContent?.includes("copied"));
  const diagnostic = await page.evaluate(() => window.__copiedDiagnostic || "");
  for (const expected of ["OTNow troubleshooting information", "OTNow version:", "Last sync error category:", "Cached dated items:"]) {
    if (!diagnostic.includes(expected)) throw new Error(`Copied diagnostics are missing: ${expected}`);
  }
  for (const forbidden of ["TEST 1000", "Sanitized test course", "Sanitized assignment", "discussion_topics/1"]) {
    if (diagnostic.includes(forbidden)) throw new Error(`Copied diagnostics leaked test data: ${forbidden}`);
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
    searchVerified: true,
    syncRecoveryVerified: true,
    diagnosticsVerified: true,
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
