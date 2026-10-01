import { GLOBAL_STATS_API_URL, GLOBAL_STATS_INTERVAL_MINUTES } from "./constants.js";
import { mergeMetrics } from "./metrics.js";

const META_KEY = "globalStatsMeta";
const REQUEST_TIMEOUT_MS = 10_000;

function number(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function buildAnonymousReport(metrics, installId, version) {
  const clean = mergeMetrics(metrics);
  return {
    schema: 1,
    installId,
    version,
    counters: {
      deadlinesDiscovered: number(clean.deadlinesDiscovered),
      assignments: number(clean.itemsByType.assignment),
      quizzes: number(clean.itemsByType.quiz),
      discussions: number(clean.itemsByType.discussion),
      events: number(clean.itemsByType.event),
      notes: number(clean.itemsByType.note),
      other: number(clean.itemsByType.other),
      remindersSent: number(clean.remindersSent),
      movedDeadlinesDetected: number(clean.movedDeadlinesDetected),
      manualCompletions: number(clean.manualCompletions),
      successfulSyncs: number(clean.successfulSyncs),
      activeDays: clean.activeDays.length,
    },
  };
}

async function readMeta({ create = false } = {}) {
  const stored = (await chrome.storage.local.get(META_KEY))[META_KEY] || {};
  if (!stored.installId && create) {
    stored.installId = crypto.randomUUID();
    stored.createdAt = new Date().toISOString();
    await chrome.storage.local.set({ [META_KEY]: stored });
  }
  return stored;
}

async function request(method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GLOBAL_STATS_API_URL, {
      method,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Anonymous statistics request failed (HTTP ${response.status}).`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function reportAnonymousStats(metrics, { force = false } = {}) {
  const meta = await readMeta({ create: true });
  const lastReport = Date.parse(meta.lastReportAt || "");
  const interval = GLOBAL_STATS_INTERVAL_MINUTES * 60_000;
  if (!force && Number.isFinite(lastReport) && Date.now() - lastReport < interval) {
    return { ok: true, skipped: true, lastReportAt: meta.lastReportAt };
  }
  try {
    const result = await request("POST", buildAnonymousReport(
      metrics,
      meta.installId,
      chrome.runtime.getManifest().version,
    ));
    const next = {
      ...meta,
      lastReportAt: new Date().toISOString(),
      lastError: null,
    };
    await chrome.storage.local.set({ [META_KEY]: next });
    return { ...result, lastReportAt: next.lastReportAt };
  } catch (error) {
    const next = { ...meta, lastError: String(error?.message || error) };
    await chrome.storage.local.set({ [META_KEY]: next });
    throw error;
  }
}

export async function deleteAnonymousStats() {
  const meta = await readMeta();
  if (meta.installId) await request("DELETE", { installId: meta.installId });
  await chrome.storage.local.remove(META_KEY);
  return { ok: true };
}

export async function getAnonymousStatsStatus() {
  const meta = await readMeta();
  return {
    hasAnonymousId: Boolean(meta.installId),
    lastReportAt: meta.lastReportAt || null,
    lastError: meta.lastError || null,
  };
}
