import test from "node:test";
import assert from "node:assert/strict";

import worker, { parseChromeWebStoreRating, validateReport, validateSiteRating } from "../stats-worker/src/worker.js";

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
          { results: [{ reportingInstallations: 3, totalItems: 48, ratingSum: 5, ratingCount: 1 }] },
          { results: [{ ratingSum: 9, ratingCount: 2 }] },
          { results: [{ averageRating: 5, ratingCount: 2, checkedAt: "2026-10-11T00:00:00.000Z" }] },
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

function siteRatingEnvironment() {
  const state = { inserted: null };
  return {
    state,
    DB: {
      prepare(sql) {
        return {
          async first() {
            if (sql.includes("FROM site_ratings")) return { recent: 0, today: 0 };
            return null;
          },
          bind(...values) {
            return {
              async run() {
                if (sql.includes("INSERT INTO site_ratings")) state.inserted = values;
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

test("accepts only a bounded anonymous site rating", () => {
  assert.equal(validateSiteRating({ rating: 5, website: "" }), true);
  assert.equal(validateSiteRating({ rating: 1 }), true);
  assert.equal(validateSiteRating({ rating: 6 }), false);
  assert.equal(validateSiteRating({ rating: 5, name: "A student" }), false);
});

test("extracts a bounded rating from the public Chrome Web Store listing", () => {
  const html = '<span role="img" aria-label="Average rating 4.8 out of 5 stars."><span>4.8</span></span><span>(<a><p>1,234 ratings</p></a>)</span>';
  assert.deepEqual(parseChromeWebStoreRating(html), { averageRating: 4.8, ratingCount: 1234 });
  assert.equal(parseChromeWebStoreRating("<html>listing changed</html>"), null);
  assert.equal(parseChromeWebStoreRating('aria-label="Average rating 9 out of 5 stars."><p>2 ratings</p>'), null);
});

test("serves the aggregate statistics endpoint without a dashboard credential", async () => {
  const response = await worker.fetch(new Request("https://stats.example/api/stats"), aggregateEnvironment());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /public/);
  const body = await response.json();
  assert.equal(body.summary.reportingInstallations, 3);
  assert.equal(body.summary.reportingInstallationsDisplay, null);
  assert.equal(body.summary.reportingInstallationsIsRounded, false);
  assert.equal(body.summary.totalItems, 48);
  assert.equal(body.summary.totalItemsDisplay, null);
  assert.equal(body.summary.totalItemsIsRounded, false);
  assert.equal(body.summary.averageRating, 4.7);
  assert.equal(body.summary.ratingCount, 3);
  assert.equal(body.summary.ratingCountDisplay, null);
  assert.deepEqual(body.chromeWebStore, {
    averageRating: 5,
    ratingCount: 2,
    checkedAt: "2026-10-11T00:00:00.000Z",
    url: "https://chromewebstore.google.com/detail/otnow/ekaachncjiajgiikgikhpafcnepompkn?hl=en-GB",
  });
  assert.equal("activity" in body, false);
  assert.equal("versions" in body, false);
  assert.equal("newInstallations" in body, false);
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

test("accepted writes cannot invalidate the public statistics cache", async () => {
  const originalCaches = globalThis.caches;
  let deletes = 0;
  globalThis.caches = { default: { delete() { deletes += 1; } } };
  try {
    const response = await worker.fetch(new Request("https://stats.example/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validReport),
    }), firstReportEnvironment());
    assert.equal(response.status, 202);
    assert.equal(deletes, 0);
  } finally {
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
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

test("records a site rating without collecting an account identifier", async () => {
  const env = siteRatingEnvironment();
  const response = await worker.fetch(new Request("https://stats.example/api/rating", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://stats.example" },
    body: JSON.stringify({ rating: 5, website: "" }),
  }), env);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, ratingAccepted: true, ratingStored: true });
  assert.equal(env.state.inserted[0], 5);
});

test("serves the OTNow product landing page from the public root", async () => {
  const response = await worker.fetch(new Request("https://stats.example/"), aggregateEnvironment());
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>OTNow — Your Canvas deadlines, organized<\/title>/);
  assert.match(html, /Every Canvas deadline/);
  assert.match(html, /One clean<\/span> sidebar/);
  assert.match(html, /src="\/product-preview\.png"/);
  assert.match(html, /Know when a deadline moves/);
  assert.match(html, /Firefox 1\.6 submitted/);
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /ekaachncjiajgiikgikhpafcnepompkn/);
  assert.match(html, /forms\/d\/e\/1FAIpQLSfvZY5paIPzJv8adIeHdkpgwzXldEqnMhM4Zbp2_c8kg7dqXw\/viewform/);
  assert.match(html, /ko-fi\.com\/sil6428/);
  assert.match(html, /src="\/landing\.js"/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(html, /--yellow|#ffc83d|#ffd864|#ffc648|#fff6df/i);
  assert.doesNotMatch(html, /Firefox available now/i);
});

test("serves the dependency-free landing interactions", async () => {
  const response = await worker.fetch(new Request("https://stats.example/landing.js"), aggregateEnvironment());
  const script = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/javascript/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /fetch\('\/api\/stats'/);
  assert.match(script, /pointermove/);
  assert.match(script, /applyTheme\(storedTheme \|\| 'light'\)/);
  assert.doesNotMatch(script, /#ffc83d|#ffd864|#ffc648|#fff6df/i);
});

test("serves the OTNow social preview artwork", async () => {
  const response = await worker.fetch(new Request("https://stats.example/social-card.svg"), aggregateEnvironment());
  const svg = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(svg, /One clean sidebar/);
  assert.match(svg, /Firefox 1\.6 submitted/);
  assert.doesNotMatch(svg, /#ffc83d|#ffd864|#ffc648|#fff6df/i);
});

test("serves the sanitized product preview through the asset binding", async () => {
  const env = aggregateEnvironment();
  env.ASSETS = {
    async fetch(request) {
      assert.match(request.url, /otnow-real-deadlines-1280x800\.png$/);
      return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
    },
  };
  const response = await worker.fetch(new Request("https://stats.example/product-preview.png"), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/png/);
});

test("public dashboard requires no token and explains the privacy boundary", async () => {
  const response = await worker.fetch(new Request("https://stats.example/dashboard"), aggregateEnvironment());
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Anonymous usage totals/);
  assert.match(html, /<title>OTNow - Stats<\/title>/);
  assert.match(html, /reporting installations/);
  assert.match(html, /community rating/);
  assert.match(html, /Chrome Web Store/);
  assert.match(html, /store-rating-link/);
  assert.match(html, /data-rating="5"/);
  assert.match(html, /forms\/d\/e\/1FAIpQLSfvZY5paIPzJv8adIeHdkpgwzXldEqnMhM4Zbp2_c8kg7dqXw\/viewform/);
  assert.match(html, /Written feedback uses a separate Google Form/);
  assert.doesNotMatch(html, /Community signal field/);
  assert.match(html, /Coursework and account information stay/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /ekaachncjiajgiikgikhpafcnepompkn/);
  assert.doesNotMatch(html, /Dashboard access token/);
});

test("serves a themed privacy policy page", async () => {
  const response = await worker.fetch(new Request("https://stats.example/privacy"), aggregateEnvironment());
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>OTNow - Privacy Policy<\/title>/);
  assert.match(html, /Optional, opt-in anonymous statistics/);
  assert.match(html, /Last updated · October 4, 2026/);
  assert.match(html, /ekaachncjiajgiikgikhpafcnepompkn/);
  assert.match(html, /Public totals may use compact display labels/);
});

test("serves a concise support page", async () => {
  const response = await worker.fetch(new Request("https://stats.example/support"), aggregateEnvironment());
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>OTNow - Support<\/title>/);
  assert.match(html, /How can we help\?/);
  assert.match(html, /Open feedback form/);
  assert.match(html, /Chrome Web Store/);
  assert.match(html, /ko-fi\.com\/sil6428/);
  assert.match(html, /security\/advisories\/new/);
  assert.match(html, /class="wash"/);
  assert.match(html, /src="\/support\.js"/);
});

test("serves a concise uninstall thank-you page", async () => {
  const response = await worker.fetch(new Request("https://stats.example/uninstall"), aggregateEnvironment());
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<title>OTNow - Thanks for trying it<\/title>/);
  assert.match(html, /Thanks for trying OTNow/);
  assert.match(html, /Uninstalling OTNow removes its local extension data through Chrome/);
  assert.match(html, /Share feedback/);
  assert.match(html, /Reinstall OTNow/);
  assert.match(html, /security\/advisories\/new/);
  assert.match(html, /class="wash"/);
  assert.match(html, /src="\/support\.js"/);
});

test("serves the reactive support background script", async () => {
  const response = await worker.fetch(new Request("https://stats.example/support.js"), aggregateEnvironment());
  const script = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/javascript/);
  assert.match(script, /prefers-reduced-motion/);
  assert.match(script, /pointermove/);
});

test("serves the OTNow browser icon", async () => {
  const response = await worker.fetch(new Request("https://stats.example/favicon.svg"), aggregateEnvironment());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await response.text(), /#ff6b35/);
});
