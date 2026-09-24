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
