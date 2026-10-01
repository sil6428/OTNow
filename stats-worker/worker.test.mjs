import test from "node:test";
import assert from "node:assert/strict";

import { COUNTER_KEYS, validateReport } from "./src/worker.js";

function validReport() {
  return {
    schema: 1,
    installId: "7787bed6-b0bf-4b20-95db-a3ef5c069b1b",
    version: "1.1.0",
    counters: Object.fromEntries(COUNTER_KEYS.map((key) => [key, 0])),
  };
}

test("accepts a strictly numeric anonymous report", () => {
  const report = validReport();
  report.counters.assignments = 12;
  assert.equal(validateReport(report), true);
  assert.equal(validateReport({ ...report, rating: 5 }), true);
});

test("rejects identifying or coursework fields", () => {
  assert.equal(validateReport({ ...validReport(), email: "student@example.com" }), false);
  assert.equal(validateReport({ ...validReport(), courseName: "Private course" }), false);
  const report = validReport();
  report.counters.assignmentTitle = "Private assignment";
  assert.equal(validateReport(report), false);
});

test("rejects malformed identifiers, versions, and counters", () => {
  assert.equal(validateReport({ ...validReport(), installId: "student-1" }), false);
  assert.equal(validateReport({ ...validReport(), version: "latest" }), false);
  const report = validReport();
  report.counters.assignments = -1;
  assert.equal(validateReport(report), false);
  assert.equal(validateReport({ ...validReport(), rating: 0 }), false);
  assert.equal(validateReport({ ...validReport(), rating: 6 }), false);
  assert.equal(validateReport({ ...validReport(), rating: "5" }), false);
});
