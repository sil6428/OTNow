const MAX_ACTIVE_DAYS = 730;
const MAX_SEEN_ITEMS = 5000;
const ITEM_TYPES = ["assignment", "quiz", "discussion", "event", "note", "other"];

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function uniqueStrings(values, limit) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value) => typeof value === "string" && value))].slice(-limit);
}

function dayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function emptyMetrics() {
  return {
    firstUsedAt: null,
    lastOpenedAt: null,
    panelOpens: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    deadlinesDiscovered: 0,
    remindersSent: 0,
    movedDeadlinesDetected: 0,
    manualCompletions: 0,
    itemsByType: Object.fromEntries(ITEM_TYPES.map((type) => [type, 0])),
    activeDays: [],
    seenItemIds: [],
  };
}

export function mergeMetrics(saved = {}) {
  const metrics = emptyMetrics();
  const seenItemIds = uniqueStrings(saved.seenItemIds, MAX_SEEN_ITEMS);
  return {
    ...metrics,
    firstUsedAt: typeof saved.firstUsedAt === "string" ? saved.firstUsedAt : null,
    lastOpenedAt: typeof saved.lastOpenedAt === "string" ? saved.lastOpenedAt : null,
    panelOpens: nonNegativeInteger(saved.panelOpens),
    successfulSyncs: nonNegativeInteger(saved.successfulSyncs),
    failedSyncs: nonNegativeInteger(saved.failedSyncs),
    deadlinesDiscovered: Math.max(nonNegativeInteger(saved.deadlinesDiscovered), seenItemIds.length),
    remindersSent: nonNegativeInteger(saved.remindersSent),
    movedDeadlinesDetected: nonNegativeInteger(saved.movedDeadlinesDetected),
    manualCompletions: nonNegativeInteger(saved.manualCompletions),
    itemsByType: Object.fromEntries(ITEM_TYPES.map((type) => [
      type,
      nonNegativeInteger(saved.itemsByType?.[type]),
    ])),
    activeDays: uniqueStrings(saved.activeDays, MAX_ACTIVE_DAYS),
    seenItemIds,
  };
}

function touch(metrics, now = new Date()) {
  const next = mergeMetrics(metrics);
  const iso = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const day = dayKey(now);
  next.firstUsedAt ||= iso;
  if (day && !next.activeDays.includes(day)) {
    next.activeDays = [...next.activeDays, day].slice(-MAX_ACTIVE_DAYS);
  }
  return next;
}

export function recordPanelOpen(metrics, now = new Date()) {
  const next = touch(metrics, now);
  next.panelOpens += 1;
  next.lastOpenedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  return next;
}

export function recordSuccessfulSync(metrics, items = [], movedCount = 0, now = new Date()) {
  const next = touch(metrics, now);
  const seen = new Set(next.seenItemIds);
  const recordedTypeTotal = Object.values(next.itemsByType).reduce((sum, value) => sum + value, 0);
  if (recordedTypeTotal === 0 && seen.size > 0) {
    const backfilled = new Set();
    for (const item of items) {
      if (!seen.has(item?.id) || backfilled.has(item.id)) continue;
      backfilled.add(item.id);
      const type = ITEM_TYPES.includes(item.type) ? item.type : "other";
      next.itemsByType[type] += 1;
    }
  }
  let newlyDiscovered = 0;
  for (const item of items) {
    const id = typeof item?.id === "string" ? item.id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    newlyDiscovered += 1;
    const type = ITEM_TYPES.includes(item.type) ? item.type : "other";
    next.itemsByType[type] += 1;
  }
  next.seenItemIds = [...seen].slice(-MAX_SEEN_ITEMS);
  next.deadlinesDiscovered += newlyDiscovered;
  next.successfulSyncs += 1;
  next.movedDeadlinesDetected += nonNegativeInteger(movedCount);
  return next;
}

export function recordFailedSync(metrics, now = new Date()) {
  const next = touch(metrics, now);
  next.failedSyncs += 1;
  return next;
}

export function recordReminders(metrics, count = 1, now = new Date()) {
  const next = touch(metrics, now);
  next.remindersSent += nonNegativeInteger(count);
  return next;
}

export function recordManualCompletion(metrics, now = new Date()) {
  const next = touch(metrics, now);
  next.manualCompletions += 1;
  return next;
}
