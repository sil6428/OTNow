import {
  CANVAS_ORIGIN,
  REMINDER_ALARM,
  REMINDER_MINUTES,
  SYNC_ALARM,
  SYNC_MINUTES,
  TYPE_LABELS,
} from "./constants.js";
import { sameDay } from "./dates.js";
import { mergePlannerItems } from "./canvas-model.js";
import { readCanvas } from "./canvas-client.js";
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
    changed = true;
  }
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
      };
      pruneTracking(next, items);
      await setState(next);
      await refreshBadge(next);
      const settings = await getSettings();
      if (!firstSync) await notifyMoved(moved, settings);
      await runReminders({ initial: firstSync });
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

async function toggleManualDone(itemId) {
  const manualDone = await getManualDone();
  manualDone[itemId] = !manualDone[itemId];
  if (!manualDone[itemId]) delete manualDone[itemId];
  await setManualDone(manualDone);
  const state = await updateState((draft) => {
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
  await refreshBadge();
}

chrome.runtime.onInstalled.addListener(() => setup());
chrome.runtime.onStartup.addListener(() => setup().then(() => syncCanvas()));

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) syncCanvas();
  if (alarm.name === REMINDER_ALARM) runReminders();
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
        sendResponse({ state: await getState(), settings: await getSettings() });
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
      case "options:get":
        sendResponse({ state: await getState(), settings: await getSettings() });
        break;
      case "options:set":
        sendResponse({ settings: await setSettings(message.settings || {}) });
        await runReminders();
        break;
      case "options:delete-data":
        await chrome.storage.local.clear();
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
