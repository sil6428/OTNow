import {
  CANVAS_ORIGIN,
  GLOBAL_STATS_ALARM,
  GLOBAL_STATS_INTERVAL_MINUTES,
  GLOBAL_STATS_ORIGIN,
  REMINDER_ALARM,
  REMINDER_MINUTES,
  SYNC_ALARM,
  SYNC_MINUTES,
  TYPE_LABELS,
  UPDATE_ALARM,
  UPDATE_CHECK_ENABLED,
  UPDATE_CHECK_MINUTES,
  UPDATE_GUIDE_URL,
  UPDATE_MANIFEST_URL,
} from "./constants.js";
import { sameDay } from "./dates.js";
import { mergePlannerItems } from "./canvas-model.js";
import { readCanvas } from "./canvas-client.js";
import { compareVersions, readPublishedVersion } from "./update-check.js";
import {
  recordFailedSync,
  recordManualCompletion,
  recordPanelOpen,
  recordReminders,
  recordSuccessfulSync,
} from "./metrics.js";
import {
  deleteAnonymousStats,
  getAnonymousStatsStatus,
  reportAnonymousStats,
  setAnonymousRating,
} from "./global-stats.js";
import {
  getManualDone,
  getSettings,
  getState,
  setManualDone,
  setSettings,
  setState,
  updateState,
} from "./storage.js";

let syncPromise = null;
let updatePromise = null;

async function hasGlobalStatsPermission() {
  return chrome.permissions.contains({ origins: [`${GLOBAL_STATS_ORIGIN}/*`] });
}

async function runGlobalStats({ force = false } = {}) {
  const settings = await getSettings();
  if (!settings.shareAnonymousStats || !(await hasGlobalStatsPermission())) {
    return { ok: false, disabled: true };
  }
  const state = await getState();
  return reportAnonymousStats(state.metrics, { force });
}

function reminderKey(item, leadMinutes) {
  return `${item.id}|${item.dueAt}|${leadMinutes}`;
}

function notificationId(prefix, value) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return `${prefix}-${Math.abs(hash)}`;
}

function pruneTracking(state, items) {
  const activePrefixes = new Set(items.map((item) => `${item.id}|${item.dueAt}|`));
  state.sentReminders = Object.fromEntries(
    Object.entries(state.sentReminders || {}).filter(([key]) => [...activePrefixes].some((prefix) => key.startsWith(prefix))),
  );
  state.notificationLinks = Object.fromEntries(Object.entries(state.notificationLinks || {}).slice(-200));
  return state;
}

async function refreshBadge(state) {
  state ||= await getState();
  const now = new Date();
  const open = state.items.filter((item) => item.status === "open");
  const overdue = open.filter((item) => Date.parse(item.dueAt) < now.getTime()).length;
  const today = open.filter((item) => Date.parse(item.dueAt) >= now.getTime() && sameDay(item.dueAt, now)).length;
  await chrome.action.setBadgeBackgroundColor({ color: overdue ? "#b91c1c" : "#1d4ed8" });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: "#ffffff" });
  await chrome.action.setBadgeText({ text: overdue ? "!" : (today ? String(Math.min(today, 99)) : "") });
}

async function createNotification(id, title, message, url) {
  await chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
    priority: 1,
  });
  return { id, url };
}

async function notifyMoved(items, settings) {
  if (!settings.notificationsEnabled || !settings.notifyMovedDates) return;
  const links = {};
  for (const item of items) {
    if (item.status !== "open") continue;
    const id = notificationId("moved", `${item.id}|${item.dueAt}`);
    const date = new Intl.DateTimeFormat(undefined, {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(new Date(item.dueAt));
    await createNotification(id, `${item.courseCode} moved a deadline`, `${item.title} is now due ${date}.`, item.url);
    links[id] = item.url;
  }
  if (Object.keys(links).length) await updateState((state) => {
    state.notificationLinks = { ...state.notificationLinks, ...links };
    return state;
  });
}

async function runReminders({ initial = false } = {}) {
  const settings = await getSettings();
  if (!settings.notificationsEnabled) return;
  const state = await getState();
  const now = Date.now();
  let changed = false;
  let remindersSent = 0;

  for (const item of state.items) {
    if (item.status !== "open" || settings.mutedCourseIds.includes(item.courseId)) continue;
    const leadMinutes = Number(settings.reminderLeads[item.type] ?? settings.reminderLeads.other);
    if (!Number.isFinite(leadMinutes) || leadMinutes < 0) continue;
    const dueAt = Date.parse(item.dueAt);
    const fireAt = dueAt - leadMinutes * 60_000;
    const key = reminderKey(item, leadMinutes);
    if (state.sentReminders[key] || fireAt > now || dueAt <= now) continue;
    if (initial) {
      state.sentReminders[key] = new Date().toISOString();
      changed = true;
      continue;
    }
    const id = notificationId("deadline", key);
    const due = new Intl.DateTimeFormat(undefined, {
      weekday: "short", hour: "numeric", minute: "2-digit",
    }).format(new Date(item.dueAt));
    await createNotification(
      id,
      `${item.courseCode}: ${TYPE_LABELS[item.type] || TYPE_LABELS.other}`,
      `${item.title} is due ${due}.`,
      item.url,
    );
    state.notificationLinks[id] = item.url;
    state.sentReminders[key] = new Date().toISOString();
    remindersSent += 1;
    changed = true;
  }
  if (remindersSent) state.metrics = recordReminders(state.metrics, remindersSent);
  if (changed) await setState(state);
}

async function syncCanvas({ userInitiated = false } = {}) {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const before = await getState();
    await setState({
      ...before,
      status: "syncing",
      startedAt: new Date().toISOString(),
      error: null,
      errorKind: null,
    });
    try {
      const manualDone = await getManualDone();
      const fresh = await readCanvas(manualDone);
      const { items, moved } = mergePlannerItems(before.items, fresh.items);
      const firstSync = !before.firstSyncComplete;
      const next = {
        ...before,
        status: "ready",
        items,
        courses: fresh.courses,
        lastSyncAt: new Date().toISOString(),
        startedAt: null,
        error: null,
        errorKind: null,
        stale: null,
        firstSyncComplete: true,
        metrics: recordSuccessfulSync(before.metrics, items, moved.length),
      };
      pruneTracking(next, items);
      await setState(next);
      await refreshBadge(next);
      const settings = await getSettings();
      if (!firstSync) await notifyMoved(moved, settings);
      await runReminders({ initial: firstSync });
      runGlobalStats().catch(() => {});
      return { ok: true };
    } catch (error) {
      const hasCache = before.items.length > 0;
      const next = {
        ...before,
        status: hasCache ? "ready" : "error",
        startedAt: null,
        error: String(error?.message || error),
        errorKind: error?.code || "error",
        stale: hasCache ? { at: new Date().toISOString(), kind: error?.code || "error" } : null,
        metrics: recordFailedSync(before.metrics),
      };
      await setState(next);
      await refreshBadge(next);
      return { ok: false, error: next.error, errorKind: next.errorKind, userInitiated };
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

async function checkForUpdate({ force = false } = {}) {
  if (!UPDATE_CHECK_ENABLED) {
    return {
      status: "managed",
      installedVersion: chrome.runtime.getManifest().version,
      latestVersion: null,
      checkedAt: null,
      error: null,
    };
  }
  if (updatePromise) return updatePromise;
  updatePromise = (async () => {
    const before = await getState();
    const installedVersion = chrome.runtime.getManifest().version;
    const previous = before.update || {};
    const checkedAt = Date.parse(previous.checkedAt || "");
    const stillFresh = Number.isFinite(checkedAt)
      && Date.now() - checkedAt < UPDATE_CHECK_MINUTES * 60_000;
    if (!force && stillFresh) return previous;

    await updateState((draft) => {
      draft.update = {
        ...previous,
        status: "checking",
        installedVersion,
        error: null,
      };
      return draft;
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(UPDATE_MANIFEST_URL, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Update check failed (HTTP ${response.status}).`);
      const latestVersion = readPublishedVersion(await response.json());
      const update = {
        status: compareVersions(latestVersion, installedVersion) > 0 ? "available" : "current",
        installedVersion,
        latestVersion,
        checkedAt: new Date().toISOString(),
        error: null,
      };
      await updateState((draft) => {
        draft.update = update;
        return draft;
      });
      return update;
    } catch (error) {
      const update = {
        ...previous,
        status: "error",
        installedVersion,
        checkedAt: new Date().toISOString(),
        error: String(error?.message || error),
      };
      await updateState((draft) => {
        draft.update = update;
        return draft;
      });
      return update;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    updatePromise = null;
  });
  return updatePromise;
}

async function toggleManualDone(itemId) {
  const manualDone = await getManualDone();
  manualDone[itemId] = !manualDone[itemId];
  if (!manualDone[itemId]) delete manualDone[itemId];
  await setManualDone(manualDone);
  const state = await updateState((draft) => {
    if (manualDone[itemId]) draft.metrics = recordManualCompletion(draft.metrics);
    draft.items = draft.items.map((item) => {
      if (item.id !== itemId || item.submitted || item.canvasComplete) return item;
      const manuallyComplete = Boolean(manualDone[itemId]);
      return { ...item, manuallyComplete, status: manuallyComplete ? "done" : "open" };
    });
    return draft;
  });
  await refreshBadge(state);
  return state;
}

async function setup() {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  const settings = await getSettings();
  await chrome.storage.local.set({ settings });
  chrome.alarms.create(SYNC_ALARM, { delayInMinutes: 1, periodInMinutes: SYNC_MINUTES });
  chrome.alarms.create(REMINDER_ALARM, { delayInMinutes: 1, periodInMinutes: REMINDER_MINUTES });
  if (UPDATE_CHECK_ENABLED) {
    chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: 2, periodInMinutes: UPDATE_CHECK_MINUTES });
  } else {
    await chrome.alarms.clear(UPDATE_ALARM);
  }
  if (settings.shareAnonymousStats && await hasGlobalStatsPermission()) {
    chrome.alarms.create(GLOBAL_STATS_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: GLOBAL_STATS_INTERVAL_MINUTES,
    });
  } else {
    await chrome.alarms.clear(GLOBAL_STATS_ALARM);
  }
  await refreshBadge();
}

async function handleInstalled(details) {
  await setup();
  if (details.reason === "install" || details.reason === "update") {
    const settings = await getSettings();
    if (!settings.statsOnboardingSeen) {
      await chrome.tabs.create({ url: chrome.runtime.getURL("options/onboarding.html") });
    }
  }
  await checkForUpdate({ force: true });
}

chrome.runtime.onInstalled.addListener((details) => handleInstalled(details).catch(console.error));
chrome.runtime.onStartup.addListener(() => setup().then(() => Promise.all([syncCanvas(), checkForUpdate()])));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) syncCanvas();
  if (alarm.name === REMINDER_ALARM) runReminders();
  if (alarm.name === UPDATE_ALARM) checkForUpdate();
  if (alarm.name === GLOBAL_STATS_ALARM) runGlobalStats();
});

chrome.notifications.onClicked.addListener(async (id) => {
  const state = await getState();
  const url = state.notificationLinks[id];
  if (url) await chrome.tabs.create({ url });
  await chrome.notifications.clear(id);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return false;
  (async () => {
    switch (message.type) {
      case "panel:get":
        sendResponse({ state: await getState(), settings: await getSettings(), globalStats: await getAnonymousStatsStatus() });
        checkForUpdate().catch(() => {});
        break;
      case "panel:opened":
        sendResponse({
          state: await updateState((draft) => {
            draft.metrics = recordPanelOpen(draft.metrics);
            return draft;
          }),
        });
        checkForUpdate().catch(() => {});
        break;
      case "panel:sync":
        sendResponse(await syncCanvas({ userInitiated: true }));
        break;
      case "panel:toggle":
        sendResponse({ state: await toggleManualDone(String(message.itemId)) });
        break;
      case "panel:open-canvas":
        await chrome.tabs.create({ url: CANVAS_ORIGIN });
        sendResponse({ ok: true });
        break;
      case "panel:open-options":
        await chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      case "panel:check-update":
        sendResponse({ update: await checkForUpdate({ force: true }) });
        break;
      case "panel:open-update-guide":
        await chrome.tabs.create({ url: UPDATE_GUIDE_URL });
        sendResponse({ ok: true });
        break;
      case "options:get":
        sendResponse({
          state: await getState(),
          settings: await getSettings(),
          globalStats: await getAnonymousStatsStatus(),
        });
        break;
      case "options:set":
        sendResponse({ settings: await setSettings(message.settings || {}) });
        await runReminders();
        break;
      case "stats:enable": {
        if (!(await hasGlobalStatsPermission())) throw new Error("Permission was not granted.");
        const settings = await setSettings({ shareAnonymousStats: true, statsOnboardingSeen: true });
        chrome.alarms.create(GLOBAL_STATS_ALARM, {
          delayInMinutes: 1,
          periodInMinutes: GLOBAL_STATS_INTERVAL_MINUTES,
        });
        const report = await runGlobalStats({ force: true });
        sendResponse({ ok: true, settings, report, globalStats: await getAnonymousStatsStatus() });
        break;
      }
      case "stats:onboarding-decline": {
        const settings = await setSettings({ statsOnboardingSeen: true, shareAnonymousStats: false });
        sendResponse({ ok: true, settings });
        break;
      }
      case "stats:onboarding-opened": {
        const settings = await setSettings({ statsOnboardingSeen: true });
        sendResponse({ ok: true, settings });
        break;
      }
      case "stats:disable": {
        if (await hasGlobalStatsPermission()) await deleteAnonymousStats();
        else await chrome.storage.local.remove("globalStatsMeta");
        const settings = await setSettings({ shareAnonymousStats: false });
        await chrome.alarms.clear(GLOBAL_STATS_ALARM);
        sendResponse({ ok: true, settings, globalStats: await getAnonymousStatsStatus() });
        break;
      }
      case "stats:report":
        sendResponse({ report: await runGlobalStats({ force: true }), globalStats: await getAnonymousStatsStatus() });
        break;
      case "stats:rate": {
        const settings = await getSettings();
        if (!settings.shareAnonymousStats || !(await hasGlobalStatsPermission())) throw new Error("Enable anonymous statistics before sharing a rating.");
        await setAnonymousRating(message.rating);
        const report = await runGlobalStats({ force: true });
        sendResponse({ ok: true, report, globalStats: await getAnonymousStatsStatus() });
        break;
      }
      case "options:delete-data":
        if ((await getSettings()).shareAnonymousStats) {
          if (!(await hasGlobalStatsPermission())) throw new Error("Anonymous statistics permission is missing. Disable sharing before deleting data.");
          await deleteAnonymousStats();
        }
        await chrome.storage.local.clear();
        await chrome.permissions.remove({ origins: [`${GLOBAL_STATS_ORIGIN}/*`] });
        await setup();
        sendResponse({ ok: true });
        break;
      case "canvas:page-ready": {
        const state = await getState();
        if (!state.lastSyncAt || state.errorKind === "signed-out" || state.errorKind === "no-tab") syncCanvas();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message" });
    }
  })().catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
  return true;
});

setup().catch(console.error);
