import { DEFAULT_SETTINGS } from "./constants.js";
import { normalizeDeadlineAdjustments } from "./deadline-adjustments.js";
import { emptyMetrics, mergeMetrics } from "./metrics.js";

export function emptyState() {
  return {
    status: "idle",
    items: [],
    courses: [],
    lastSyncAt: null,
    startedAt: null,
    error: null,
    errorKind: null,
    stale: null,
    sentReminders: {},
    notificationLinks: {},
    firstSyncComplete: false,
    metrics: emptyMetrics(),
    update: {
      status: "idle",
      installedVersion: null,
      latestVersion: null,
      checkedAt: null,
      error: null,
    },
  };
}

export function mergeSettings(saved = {}) {
  const migratedTheme = !saved.schemaVersion && saved.theme === "system" ? "light" : saved.theme;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    theme: migratedTheme || DEFAULT_SETTINGS.theme,
    reminderLeads: {
      ...DEFAULT_SETTINGS.reminderLeads,
      ...(saved.reminderLeads || {}),
    },
    mutedCourseIds: Array.isArray(saved.mutedCourseIds) ? saved.mutedCourseIds : [],
  };
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return mergeSettings(settings);
}

export async function setSettings(nextOrUpdater) {
  const current = await getSettings();
  const next = typeof nextOrUpdater === "function"
    ? nextOrUpdater(structuredClone(current)) || current
    : { ...current, ...nextOrUpdater };
  const merged = mergeSettings(next);
  await chrome.storage.local.set({ settings: merged });
  return merged;
}

export async function getState() {
  const { state } = await chrome.storage.local.get("state");
  if (!state) return emptyState();
  const empty = emptyState();
  return {
    ...empty,
    ...state,
    metrics: mergeMetrics(state.metrics),
    update: { ...empty.update, ...(state.update || {}) },
  };
}

export async function setState(state) {
  await chrome.storage.local.set({ state });
  return state;
}

export async function updateState(updater) {
  const state = await getState();
  const next = (await updater(structuredClone(state))) || state;
  return setState(next);
}

export async function getManualDone() {
  const { manualDone } = await chrome.storage.local.get("manualDone");
  return manualDone && typeof manualDone === "object" ? manualDone : {};
}

export async function setManualDone(manualDone) {
  await chrome.storage.local.set({ manualDone });
}

export async function getDeadlineAdjustments() {
  const { deadlineAdjustments } = await chrome.storage.local.get("deadlineAdjustments");
  return normalizeDeadlineAdjustments(deadlineAdjustments);
}

export async function setDeadlineAdjustments(deadlineAdjustments) {
  const clean = normalizeDeadlineAdjustments(deadlineAdjustments);
  await chrome.storage.local.set({ deadlineAdjustments: clean });
  return clean;
}
