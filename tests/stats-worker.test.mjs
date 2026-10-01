import test from "node:test";
import assert from "node:assert/strict";

import worker, { validateReport } from "../stats-worker/src/worker.js";

const validReport = {
  schema: 1,
  installId: "7787bed6-b0bf-4b20-95db-a3ef5c069b1b",
  version: "1.2.0",
  counters: {
    deadlinesDiscovered: 8,
    assignments: 4,
    quizzes: 2,
    discussions: 1,
    events: 1,
    notes: 0,
    other: 0,
    remindersSent: 3,
    movedDeadlinesDetected: 1,
    manualCompletions: 2,
    successfulSyncs: 5,
    activeDays: 2,
  },
};

function aggregateEnvironment() {
  return {
    DB: {
      prepare(sql) {
        return { sql };
      },
      async batch() {
        return [
          { results: [{ reportingInstallations: 3, totalItems: 48 }] },
          { results: [{ active24h: 1, active7d: 2, active30d: 3 }] },
          { results: [{ version: "1.2.0", installations: 3 }] },
          { results: [{ day: "2026-10-01", installs: 2 }] },
        ];
      },
    },
  };
}

test("accepts only the documented anonymous report shape", () => {
  assert.equal(validateReport(validReport), true);
  assert.equal(validateReport({ ...validReport, email: "student@example.com" }), false);
  assert.equal(validateReport({ ...validReport, counters: { ...validReport.counters, courseName: 1 } }), false);
});

test("serves the aggregate statistics endpoint without a dashboard credential", async () => {
  const response = await worker.fetch(new Request("https://stats.example/api/stats"), aggregateEnvironment());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /public/);
  const body = await response.json();
  assert.equal(body.summary.reportingInstallations, 3);
  assert.equal(body.activity.active30d, 3);
  assert.deepEqual(body.versions, [{ version: "1.2.0", installations: 3 }]);
  assert(!JSON.stringify(body).includes("id_hash"));
});

test("public dashboard requires no token and explains the privacy boundary", async () => {
  const response = await worker.fetch(new Request("https://stats.example/dashboard"), aggregateEnvironment());
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Community pulse/);
  assert.match(html, /Numbers, never coursework/);
  assert.doesNotMatch(html, /Dashboard access token/);
});

test("serves the OTNow browser icon", async () => {
  const response = await worker.fetch(new Request("https://stats.example/favicon.svg"), aggregateEnvironment());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await response.text(), /#ff6b35/);
});
