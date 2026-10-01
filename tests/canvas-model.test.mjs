import test from "node:test";
import assert from "node:assert/strict";

import {
  dueAtFor,
  mergePlannerItems,
  normalizePlannerItem,
  normalizeType,
  parseNextLink,
  submissionComplete,
} from "../src/canvas-model.js";
import { bucketFor } from "../src/dates.js";
import { mergeSettings } from "../src/storage.js";
import { countPlannerTypes, groupPlannerItems } from "../src/view-model.js";
import { compareVersions, readPublishedVersion, versionParts } from "../src/update-check.js";
import {
  emptyMetrics,
  mergeMetrics,
  recordFailedSync,
  recordManualCompletion,
  recordPanelOpen,
  recordReminders,
  recordSuccessfulSync,
} from "../src/metrics.js";
import { buildAnonymousReport } from "../src/global-stats.js";

const courses = {
  "42": { id: "42", code: "INFR 4611U", name: "Trust Systems", color: "#2563eb" },
};

test("normalizes common Canvas planner types", () => {
  assert.equal(normalizeType("discussion_topic"), "discussion");
  assert.equal(normalizeType("quiz"), "quiz");
  assert.equal(normalizeType("calendar_event"), "event");
  assert.equal(normalizeType("unknown"), "other");
});

test("selects a valid due date from Canvas response shapes", () => {
  assert.equal(dueAtFor({ plannable: { due_at: "2026-09-30T03:59:00Z" } }), "2026-09-30T03:59:00Z");
  assert.equal(dueAtFor({ plannable_date: "2026-10-02T15:00:00Z" }), "2026-10-02T15:00:00Z");
  assert.equal(dueAtFor({ plannable: {} }), null);
});

test("recognizes submitted and graded planner states", () => {
  assert.equal(submissionComplete({ graded: true }), true);
  assert.equal(submissionComplete({ needs_grading: true }), true);
  assert.equal(submissionComplete({ workflow_state: "submitted" }), true);
  assert.equal(submissionComplete({ missing: true }), false);
  assert.equal(submissionComplete(false), false);
});

test("normalizes an assignment and preserves a local check-off", () => {
  const raw = {
    course_id: 42,
    plannable_id: 99,
    plannable_type: "assignment",
    plannable: { title: "Threat model", due_at: "2026-09-30T03:59:00Z" },
    html_url: "/courses/42/assignments/99",
    submissions: { missing: true },
  };
  const item = normalizePlannerItem(raw, courses, { "assignment:99": true });
  assert.equal(item.courseCode, "INFR 4611U");
  assert.equal(item.status, "done");
  assert.equal(item.manuallyComplete, true);
  assert.equal(item.url, "https://learn.ontariotechu.ca/courses/42/assignments/99");
});

test("Canvas submission status takes priority over a manual state", () => {
  const item = normalizePlannerItem({
    course_id: 42,
    plannable_id: 100,
    plannable_type: "quiz",
    plannable: { title: "Quiz 1", due_at: "2026-09-30T03:59:00Z" },
    submissions: { workflow_state: "graded" },
  }, courses, {});
  assert.equal(item.status, "submitted");
});

test("detects a moved due date and retains the old date", () => {
  const before = [{ id: "assignment:99", dueAt: "2026-09-30T03:59:00.000Z", status: "open" }];
  const after = [{ id: "assignment:99", dueAt: "2026-10-02T03:59:00.000Z", status: "open", moved: null }];
  const result = mergePlannerItems(before, after, new Date("2026-09-24T12:00:00Z"));
  assert.equal(result.moved.length, 1);
  assert.equal(result.items[0].moved.from, before[0].dueAt);
});

test("accepts only Canvas next-page links", () => {
  const valid = '<https://learn.ontariotechu.ca/api/v1/planner/items?page=2>; rel="next"';
  const foreign = '<https://evil.example/api/v1/planner/items?page=2>; rel="next"';
  assert.equal(parseNextLink(valid), "/api/v1/planner/items?page=2");
  assert.equal(parseNextLink(foreign), null);
});

test("buckets open and completed items", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  assert.equal(bucketFor({ status: "open", dueAt: "2026-09-24T20:00:00Z" }, now), "today");
  assert.equal(bucketFor({ status: "open", dueAt: "2026-09-24T10:00:00Z" }, now), "overdue");
  assert.equal(bucketFor({ status: "done", dueAt: "2026-09-24T20:00:00Z" }, now), "completed");
});

test("migrates the old default theme to the Canvas-matching light theme", () => {
  assert.equal(mergeSettings({ theme: "system" }).theme, "light");
  assert.equal(mergeSettings({ schemaVersion: 2, theme: "system" }).theme, "system");
  assert.equal(mergeSettings({ theme: "dark" }).theme, "dark");
});

test("groups planner items by type without hiding supported Canvas types", () => {
  const items = [
    { id: "a", type: "assignment", dueAt: "2026-09-28T12:00:00Z", status: "open" },
    { id: "q", type: "quiz", dueAt: "2026-09-27T12:00:00Z", status: "open" },
    { id: "d", type: "discussion", dueAt: "2026-09-26T12:00:00Z", status: "open" },
    { id: "e", type: "event", dueAt: "2026-09-29T12:00:00Z", status: "open" },
    { id: "n", type: "note", dueAt: "2026-09-30T12:00:00Z", status: "open" },
    { id: "o", type: "other", dueAt: "2026-10-01T12:00:00Z", status: "open" },
  ];
  const groups = groupPlannerItems(items, "type");
  assert.deepEqual(groups.map((group) => group.id), ["assignment", "quiz", "discussion", "event", "note", "other"]);
  assert.deepEqual(countPlannerTypes(items), {
    assignment: 1,
    quiz: 1,
    discussion: 1,
    event: 1,
    note: 1,
    other: 1,
  });
});

test("compares strict three-part OTNow versions", () => {
  assert.deepEqual(versionParts("1.2.3"), [1, 2, 3]);
  assert.equal(versionParts("1.2"), null);
  assert.equal(compareVersions("0.5.1", "0.5.0"), 1);
  assert.equal(compareVersions("0.5.0", "0.5.0"), 0);
  assert.equal(compareVersions("0.4.9", "0.5.0"), -1);
});

test("accepts only a valid OTNow repository manifest", () => {
  assert.equal(readPublishedVersion({ name: "OTNow", version: "0.5.0" }), "0.5.0");
  assert.throws(() => readPublishedVersion({ name: "Different extension", version: "9.9.9" }));
  assert.throws(() => readPublishedVersion({ name: "OTNow", version: "latest" }));
});

test("records local activity without storing coursework content", () => {
  const opened = recordPanelOpen(emptyMetrics(), new Date("2026-09-25T12:00:00Z"));
  const synced = recordSuccessfulSync(opened, [
    { id: "assignment:1", type: "assignment", title: "Private title" },
    { id: "quiz:2", type: "quiz", title: "Another private title" },
  ], 1, new Date("2026-09-25T12:05:00Z"));
  const repeated = recordSuccessfulSync(synced, [{ id: "assignment:1" }], 0, new Date("2026-09-26T12:05:00Z"));
  const testNow = new Date("2026-09-26T13:00:00Z");
  const reminded = recordReminders(repeated, 2, testNow);
  const completed = recordManualCompletion(reminded, testNow);
  const failed = recordFailedSync(completed, testNow);

  assert.equal(failed.panelOpens, 1);
  assert.equal(failed.successfulSyncs, 2);
  assert.equal(failed.failedSyncs, 1);
  assert.equal(failed.deadlinesDiscovered, 2);
  assert.equal(failed.movedDeadlinesDetected, 1);
  assert.equal(failed.remindersSent, 2);
  assert.equal(failed.manualCompletions, 1);
  assert.deepEqual(failed.itemsByType, {
    assignment: 1,
    quiz: 1,
    discussion: 0,
    event: 0,
    note: 0,
    other: 0,
  });
  assert.deepEqual(failed.activeDays, ["2026-09-25", "2026-09-26"]);
  assert(!JSON.stringify(failed).includes("Private title"));
});

test("builds a strict anonymous report containing only numerical totals", () => {
  const metrics = recordSuccessfulSync(emptyMetrics(), [
    { id: "assignment:1", type: "assignment", title: "Never transmit this" },
    { id: "discussion:2", type: "discussion", courseCode: "PRIVATE 101" },
  ]);
  const report = buildAnonymousReport(
    metrics,
    "7787bed6-b0bf-4b20-95db-a3ef5c069b1b",
    "1.2.0",
  );
  assert.deepEqual(Object.keys(report).sort(), ["counters", "installId", "schema", "version"]);
  assert.equal(report.counters.deadlinesDiscovered, 2);
  assert.equal(report.counters.assignments, 1);
  assert.equal(report.counters.discussions, 1);
  const serialized = JSON.stringify(report);
  assert(!serialized.includes("Never transmit this"));
  assert(!serialized.includes("PRIVATE 101"));
});

test("repairs malformed saved activity totals", () => {
  const metrics = mergeMetrics({
    panelOpens: -4,
    successfulSyncs: "3",
    deadlinesDiscovered: 1,
    seenItemIds: ["assignment:1", "assignment:1", "quiz:2"],
    activeDays: ["2026-09-25", "2026-09-25"],
  });
  assert.equal(metrics.panelOpens, 0);
  assert.equal(metrics.successfulSyncs, 3);
  assert.equal(metrics.deadlinesDiscovered, 2);
  assert.deepEqual(metrics.seenItemIds, ["assignment:1", "quiz:2"]);
  assert.deepEqual(metrics.activeDays, ["2026-09-25"]);
});

test("backfills broad item types when upgrading legacy Insights data", () => {
  const legacy = mergeMetrics({
    deadlinesDiscovered: 2,
    seenItemIds: ["assignment:1", "quiz:2"],
  });
  const migrated = recordSuccessfulSync(legacy, [
    { id: "assignment:1", type: "assignment" },
    { id: "quiz:2", type: "quiz" },
  ]);
  assert.equal(migrated.deadlinesDiscovered, 2);
  assert.equal(migrated.itemsByType.assignment, 1);
  assert.equal(migrated.itemsByType.quiz, 1);
});
