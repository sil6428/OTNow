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

function firstReportEnvironment(total = 17) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("SELECT last_seen")) return null;
                if (sql.includes("COUNT(*) AS total")) return { total };
                return null;
              },
              async run() {
                return { success: true };
              },
            };
          },
          async first() {
            if (sql.includes("COUNT(*) AS total")) return { total };
            return null;
          },
        };
      },
    },
  };
}

function recentReportEnvironment() {
  return {
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("SELECT last_seen")) {
                  return { last_seen: new Date().toISOString().slice(0, 19).replace("T", " "), rating: null };
                }
                return null;
              },
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    },
  };
}

test("accepts only the documented anonymous report shape", () => {
  assert.equal(validateReport(validReport), true);
  assert.equal(validateReport({ ...validReport, rating: 4 }), true);
  assert.equal(validateReport({ ...validReport, rating: 9 }), false);
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

test("returns an aggregate opt-in position after a first accepted report", async () => {
  const response = await worker.fetch(new Request("https://stats.example/api/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validReport),
  }), firstReportEnvironment());
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, accepted: true, reportingPosition: 17 });
});

test("accepts a changed rating even inside the report rate limit", async () => {
  const response = await worker.fetch(new Request("https://stats.example/api/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validReport, rating: 5 }),
  }), recentReportEnvironment());
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, accepted: true, ratingUpdated: true });
});

test("public dashboard requires no token and explains the privacy boundary", async () => {
  const response = await worker.fetch(new Request("https://stats.example/dashboard"), aggregateEnvironment());
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Anonymous community totals/);
  assert.match(html, /<title>OTNow - Stats<\/title>/);
  assert.match(html, /reporting users/);
  assert.match(html, /community rating/);
  assert.doesNotMatch(html, /Community signal field/);
  assert.match(html, /Broad numbers only—never coursework/);
  assert.doesNotMatch(html, /Dashboard access token/);
});

test("serves the OTNow browser icon", async () => {
  const response = await worker.fetch(new Request("https://stats.example/favicon.svg"), aggregateEnvironment());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await response.text(), /#ff6b35/);
});
