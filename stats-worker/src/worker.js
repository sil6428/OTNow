const MAX_BODY_BYTES = 4096;
const MAX_COUNTER = 10_000_000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COUNTER_KEYS = [
  "deadlinesDiscovered",
  "assignments",
  "quizzes",
  "discussions",
  "events",
  "notes",
  "other",
  "remindersSent",
  "movedDeadlinesDetected",
  "manualCompletions",
  "successfulSyncs",
  "activeDays",
];

const ALLOWED_REPORT_KEYS = new Set(["schema", "installId", "version", "counters"]);
const ALLOWED_COUNTER_KEYS = new Set(COUNTER_KEYS);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function counter(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_COUNTER;
}

export function validateReport(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (Object.keys(payload).some((key) => !ALLOWED_REPORT_KEYS.has(key))) return false;
  if (payload.schema !== 1 || !UUID_PATTERN.test(String(payload.installId || ""))) return false;
  if (!VERSION_PATTERN.test(String(payload.version || ""))) return false;
  if (!payload.counters || typeof payload.counters !== "object" || Array.isArray(payload.counters)) return false;
  if (Object.keys(payload.counters).some((key) => !ALLOWED_COUNTER_KEYS.has(key))) return false;
  return COUNTER_KEYS.every((key) => counter(payload.counters[key]));
}

async function readReport(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("too-large");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("too-large");
  const payload = JSON.parse(text);
  if (!validateReport(payload)) throw new Error("invalid-report");
  return payload;
}

async function hashIdentifier(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left = "", right = "") {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

function sqliteTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseSqliteTimestamp(value) {
  return Date.parse(`${String(value).replace(" ", "T")}Z`);
}

async function report(request, env) {
  let payload;
  try {
    payload = await readReport(request);
  } catch (error) {
    return json({ ok: false, error: error.message === "too-large" ? "Report is too large." : "Invalid anonymous report." }, 400);
  }

  const idHash = await hashIdentifier(payload.installId);
  const now = sqliteTimestamp();
  const existing = await env.DB.prepare("SELECT last_seen FROM installations WHERE id_hash = ?").bind(idHash).first();
  if (existing?.last_seen && Date.now() - parseSqliteTimestamp(existing.last_seen) < 15 * 60 * 1000) {
    return json({ ok: true, accepted: false, reason: "recent-report" }, 202);
  }

  const values = payload.counters;
  await env.DB.prepare(`
    INSERT INTO installations (
      id_hash, first_seen, last_seen, version, total_items, assignments, quizzes,
      discussions, events, notes, other_items, reminders_sent, moved_deadlines,
      manual_completions, successful_syncs, active_days, report_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id_hash) DO UPDATE SET
      last_seen = excluded.last_seen,
      version = excluded.version,
      total_items = MAX(installations.total_items, excluded.total_items),
      assignments = MAX(installations.assignments, excluded.assignments),
      quizzes = MAX(installations.quizzes, excluded.quizzes),
      discussions = MAX(installations.discussions, excluded.discussions),
      events = MAX(installations.events, excluded.events),
      notes = MAX(installations.notes, excluded.notes),
      other_items = MAX(installations.other_items, excluded.other_items),
      reminders_sent = MAX(installations.reminders_sent, excluded.reminders_sent),
      moved_deadlines = MAX(installations.moved_deadlines, excluded.moved_deadlines),
      manual_completions = MAX(installations.manual_completions, excluded.manual_completions),
      successful_syncs = MAX(installations.successful_syncs, excluded.successful_syncs),
      active_days = MAX(installations.active_days, excluded.active_days),
      report_count = installations.report_count + 1
  `).bind(
    idHash,
    now,
    now,
    payload.version,
    values.deadlinesDiscovered,
    values.assignments,
    values.quizzes,
    values.discussions,
    values.events,
    values.notes,
    values.other,
    values.remindersSent,
    values.movedDeadlinesDetected,
    values.manualCompletions,
    values.successfulSyncs,
    values.activeDays,
  ).run();

  return json({ ok: true, accepted: true }, 202);
}

async function removeReport(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid deletion request." }, 400);
  }
  if (!body || Object.keys(body).some((key) => key !== "installId") || !UUID_PATTERN.test(String(body.installId || ""))) {
    return json({ ok: false, error: "Invalid deletion request." }, 400);
  }
  const idHash = await hashIdentifier(body.installId);
  await env.DB.prepare("DELETE FROM installations WHERE id_hash = ?").bind(idHash).run();
  return json({ ok: true });
}

async function globalStats(env) {
  const [summaryResult, activityResult, versionsResult, growthResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS reportingInstallations,
        COALESCE(SUM(total_items), 0) AS totalItems,
        COALESCE(SUM(assignments), 0) AS assignments,
        COALESCE(SUM(quizzes), 0) AS quizzes,
        COALESCE(SUM(discussions), 0) AS discussions,
        COALESCE(SUM(events), 0) AS events,
        COALESCE(SUM(notes), 0) AS notes,
        COALESCE(SUM(other_items), 0) AS otherItems,
        COALESCE(SUM(reminders_sent), 0) AS remindersSent,
        COALESCE(SUM(moved_deadlines), 0) AS movedDeadlines,
        COALESCE(SUM(manual_completions), 0) AS manualCompletions,
        COALESCE(SUM(successful_syncs), 0) AS successfulSyncs,
        COALESCE(SUM(active_days), 0) AS activeDays
      FROM installations
    `),
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN last_seen >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS active24h,
        SUM(CASE WHEN last_seen >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS active7d,
        SUM(CASE WHEN last_seen >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS active30d
      FROM installations
    `),
    env.DB.prepare("SELECT version, COUNT(*) AS installations FROM installations GROUP BY version ORDER BY installations DESC, version DESC LIMIT 10"),
    env.DB.prepare("SELECT substr(first_seen, 1, 10) AS day, COUNT(*) AS installs FROM installations WHERE first_seen >= datetime('now', '-30 days') GROUP BY day ORDER BY day"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    summary: summaryResult.results?.[0] || {},
    activity: activityResult.results?.[0] || {},
    versions: versionsResult.results || [],
    newInstallations: growthResult.results || [],
  };
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OTNow global statistics</title>
  <style>
    :root{color-scheme:light dark;--navy:#003c71;--blue:#0077ca;--orange:#e75d2a;--bg:#f4f6f7;--surface:#fff;--text:#27343d;--muted:#68757e;--line:#d7dde1} @media(prefers-color-scheme:dark){:root{--navy:#082f49;--blue:#55b7f3;--orange:#ff875d;--bg:#111820;--surface:#19232c;--text:#f1f4f6;--muted:#b1bbc2;--line:#3e4c56}}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}.top{height:58px;border-bottom:3px solid var(--orange);background:var(--navy);color:#fff}.top div,main{width:min(1000px,calc(100% - 32px));margin:auto}.top div{display:flex;height:100%;align-items:center;justify-content:space-between}.brand{font-size:18px;font-weight:800}.brand i{display:inline-block;width:8px;height:8px;margin-right:9px;border-radius:2px;background:var(--orange)}.scope{font-size:12px;opacity:.78}main{padding:38px 0 60px}h1{margin:0;font-size:28px;letter-spacing:-.03em}header p{margin:5px 0 0;color:var(--muted)}form{display:flex;gap:8px;max-width:530px;margin:24px 0}input{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--text)}button{padding:10px 15px;border:0;border-radius:6px;background:var(--blue);color:white;font-weight:700;cursor:pointer}.status{min-height:22px;color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-top:24px;border:1px solid var(--line);background:var(--line)}.metric{min-height:112px;padding:18px;background:var(--surface)}.metric strong{display:block;color:var(--blue);font-size:30px;font-variant-numeric:tabular-nums}.metric span{color:var(--muted);font-size:12px}.sections{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:22px}.panel{padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}h2{margin:0 0 15px;font-size:16px}.row{display:flex;justify-content:space-between;gap:15px;padding:8px 0;border-top:1px solid var(--line)}.row:first-of-type{border-top:0}.row span{color:var(--muted)}.bar{height:8px;margin:5px 0 10px;background:var(--line)}.bar i{display:block;height:100%;background:var(--blue)}.foot{margin-top:22px;color:var(--muted);font-size:12px}@media(max-width:720px){.grid{grid-template-columns:1fr 1fr}.sections{grid-template-columns:1fr}.scope{display:none}}@media(max-width:420px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="top"><div><span class="brand"><i></i>OTNow</span><span class="scope">Private developer dashboard</span></div></div>
  <main>
    <header><h1>Global product statistics</h1><p>Anonymous, opt-in numerical totals from reporting OTNow installations.</p></header>
    <form id="login"><input id="token" type="password" autocomplete="current-password" placeholder="Dashboard access token" aria-label="Dashboard access token"><button type="submit">View dashboard</button></form>
    <p id="status" class="status">Enter the private dashboard token to load statistics.</p>
    <section id="dashboard" hidden>
      <div id="metrics" class="grid"></div>
      <div class="sections"><section class="panel"><h2>Reporting activity</h2><div id="activity"></div></section><section class="panel"><h2>Canvas items organized</h2><div id="items"></div></section></div>
      <div class="sections"><section class="panel"><h2>Version distribution</h2><div id="versions"></div></section><section class="panel"><h2>New reporting installations · 30 days</h2><div id="growth"></div></section></div>
      <p class="foot">No course names, assignment names, URLs, grades, emails, student identifiers, or Canvas identifiers are collected. “Reporting installations” includes only students who explicitly enabled anonymous statistics.</p>
    </section>
  </main>
  <script src="/dashboard.js"></script>
</body>
</html>`;

const DASHBOARD_JS = `const form=document.querySelector('#login'),tokenInput=document.querySelector('#token'),status=document.querySelector('#status'),dashboard=document.querySelector('#dashboard');const number=new Intl.NumberFormat();const row=(label,value)=>{const div=document.createElement('div');div.className='row';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=number.format(Number(value)||0);div.append(a,b);return div};const metric=(label,value)=>{const div=document.createElement('div');div.className='metric';const strong=document.createElement('strong');strong.textContent=number.format(Number(value)||0);const span=document.createElement('span');span.textContent=label;div.append(strong,span);return div};function bars(target,rows,labelKey,valueKey){target.replaceChildren();const max=Math.max(1,...rows.map(x=>Number(x[valueKey])||0));for(const item of rows){const wrap=document.createElement('div');const top=row(item[labelKey],item[valueKey]);const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('i');fill.style.width=((Number(item[valueKey])||0)/max*100)+'%';bar.append(fill);wrap.append(top,bar);target.append(wrap)}}async function load(token){status.textContent='Loading…';const response=await fetch('/api/stats',{headers:{authorization:'Bearer '+token}});if(!response.ok)throw new Error(response.status===401?'Incorrect dashboard token.':'Statistics are temporarily unavailable.');const data=await response.json(),s=data.summary||{},a=data.activity||{};sessionStorage.setItem('otnow-dashboard-token',token);document.querySelector('#metrics').replaceChildren(metric('Reporting installations',s.reportingInstallations),metric('Canvas items organized',s.totalItems),metric('Reminders delivered',s.remindersSent),metric('Changed dates caught',s.movedDeadlines));document.querySelector('#activity').replaceChildren(row('Active in last 24 hours',a.active24h),row('Active in last 7 days',a.active7d),row('Active in last 30 days',a.active30d),row('Successful Canvas refreshes',s.successfulSyncs),row('Combined days used',s.activeDays));document.querySelector('#items').replaceChildren(row('Assignments',s.assignments),row('Quizzes',s.quizzes),row('Discussions',s.discussions),row('Events',s.events),row('Planner notes',s.notes),row('Other dated items',s.otherItems),row('Manual check-offs',s.manualCompletions));bars(document.querySelector('#versions'),data.versions||[],'version','installations');bars(document.querySelector('#growth'),data.newInstallations||[],'day','installs');dashboard.hidden=false;status.textContent='Updated '+new Date(data.generatedAt).toLocaleString()}form.addEventListener('submit',event=>{event.preventDefault();load(tokenInput.value).catch(error=>{dashboard.hidden=true;status.textContent=error.message})});const saved=sessionStorage.getItem('otnow-dashboard-token');if(saved){tokenInput.value=saved;load(saved).catch(()=>sessionStorage.removeItem('otnow-dashboard-token'))}`;

function htmlResponse(body, contentType = "text/html; charset=utf-8") {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname === "/api/report") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, DELETE, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
        },
      });
    }
    if (url.pathname === "/api/report" && request.method === "POST") return report(request, env);
    if (url.pathname === "/api/report" && request.method === "DELETE") return removeReport(request, env);
    if (url.pathname === "/api/stats" && request.method === "GET") {
      const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
      if (!env.DASHBOARD_TOKEN || !safeEqual(token, env.DASHBOARD_TOKEN)) return json({ ok: false, error: "Unauthorized" }, 401);
      return json(await globalStats(env));
    }
    if ((url.pathname === "/" || url.pathname === "/dashboard") && request.method === "GET") return htmlResponse(DASHBOARD_HTML);
    if (url.pathname === "/dashboard.js" && request.method === "GET") return htmlResponse(DASHBOARD_JS, "text/javascript; charset=utf-8");
    return json({ ok: false, error: "Not found" }, 404);
  },
  async scheduled(_controller, env) {
    await env.DB.prepare("DELETE FROM installations WHERE last_seen < datetime('now', '-180 days')").run();
  },
};
