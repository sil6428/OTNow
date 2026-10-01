import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDeadlineAdjustments,
  normalizeDeadlineAdjustments,
  reconcileDeadlineAdjustments,
  restoreCanvasDeadlines,
} from "../src/deadline-adjustments.js";

const item = {
  id: "assignment:42",
  title: "Lab report",
  dueAt: "2026-10-02T20:00:00.000Z",
  status: "open",
};

test("applies a valid local extension without losing the Canvas due date", () => {
  const [adjusted] = applyDeadlineAdjustments([item], {
    "assignment:42": "2026-10-05T20:00:00Z",
  });
  assert.equal(adjusted.dueAt, "2026-10-05T20:00:00.000Z");
  assert.equal(adjusted.canvasDueAt, item.dueAt);
  assert.equal(adjusted.deadlineAdjusted, true);
});

test("restores the Canvas deadline when an extension is removed", () => {
  const [adjusted] = applyDeadlineAdjustments([item], {
    "assignment:42": "2026-10-05T20:00:00Z",
  });
  assert.deepEqual(restoreCanvasDeadlines([adjusted]), [item]);
});

test("drops malformed saved deadline adjustments", () => {
  assert.deepEqual(normalizeDeadlineAdjustments({
    "assignment:42": "not-a-date",
    "quiz:7": "2026-10-06T12:30:00Z",
    empty: 7,
  }), {
    "quiz:7": "2026-10-06T12:30:00.000Z",
  });
});

test("removes stale or superseded adjustments during a Canvas refresh", () => {
  assert.deepEqual(reconcileDeadlineAdjustments([item], {
    "assignment:42": "2026-10-01T20:00:00Z",
    "assignment:missing": "2026-10-10T20:00:00Z",
  }), {});
  assert.deepEqual(reconcileDeadlineAdjustments([item], {
    "assignment:42": "2026-10-05T20:00:00Z",
  }), {
    "assignment:42": "2026-10-05T20:00:00.000Z",
  });
});
