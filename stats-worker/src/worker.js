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
  <meta name="description" content="Live, anonymous, opt-in usage statistics for OTNow.">
  <meta name="theme-color" content="#06111f">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>OTNow · Community statistics</title>
  <style>
    :root{color-scheme:dark;--bg:#050b12;--surface:rgba(11,25,39,.72);--text:#eef7ff;--muted:#8ea5b8;--line:rgba(142,187,218,.16);--blue:#32a9ff;--cyan:#5ce1e6;--orange:#ff6b35;--green:#56d8a0;--shadow:0 24px 80px rgba(0,0,0,.32)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{min-height:100vh;margin:0;overflow-x:hidden;background:var(--bg);color:var(--text);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}.backdrop{position:fixed;inset:0;z-index:-2;background:radial-gradient(circle at 14% 12%,rgba(0,119,202,.24),transparent 31%),radial-gradient(circle at 84% 8%,rgba(255,107,53,.13),transparent 24%),linear-gradient(145deg,#07111c 0%,#04090f 52%,#071421 100%)}.backdrop:before{position:absolute;inset:0;content:"";opacity:.22;background-image:linear-gradient(rgba(126,188,228,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(126,188,228,.13) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(to bottom,#000,transparent 78%)}.orb{position:fixed;z-index:-1;width:420px;height:420px;border-radius:50%;filter:blur(90px);opacity:.16;pointer-events:none;animation:drift 14s ease-in-out infinite alternate}.orb.one{top:-170px;left:8%;background:var(--blue)}.orb.two{top:22%;right:-210px;background:var(--orange);animation-delay:-6s}.shell{width:min(1160px,calc(100% - 40px));margin:auto}.top{position:sticky;top:0;z-index:10;border-bottom:1px solid var(--line);background:rgba(5,11,18,.72);backdrop-filter:blur(18px)}.nav{display:flex;min-height:68px;align-items:center;justify-content:space-between}.brand{display:inline-flex;align-items:center;gap:11px;color:#fff;font-size:19px;font-weight:820;letter-spacing:-.02em;text-decoration:none}.logo{position:relative;width:28px;height:28px;border:2px solid var(--blue);border-radius:9px;transform:rotate(45deg);box-shadow:0 0 30px rgba(50,169,255,.32)}.logo:after{position:absolute;width:9px;height:9px;inset:7px;content:"";border-radius:3px;background:var(--orange)}.brand-text{display:inline-block}.nav-meta{display:flex;align-items:center;gap:16px}.live{display:inline-flex;align-items:center;gap:7px;color:#b8cad8;font-size:12px}.live:before{width:7px;height:7px;content:"";border-radius:50%;background:var(--green);box-shadow:0 0 0 5px rgba(86,216,160,.1);animation:pulse 2s infinite}.github{padding:8px 12px;border:1px solid var(--line);border-radius:9px;color:#dcecf8;font-size:12px;font-weight:700;text-decoration:none;transition:.2s ease}.github:hover{border-color:rgba(50,169,255,.55);background:rgba(50,169,255,.08);transform:translateY(-1px)}main{padding:76px 0 64px}.hero{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:44px;align-items:end;margin-bottom:38px}.eyebrow{display:inline-flex;align-items:center;gap:8px;margin:0 0 17px;color:var(--cyan);font:700 12px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase}.eyebrow:before{width:24px;height:1px;content:"";background:currentColor}h1{max-width:820px;margin:0;font-size:clamp(44px,7vw,78px);font-weight:760;line-height:.96;letter-spacing:-.065em}.gradient{background:linear-gradient(100deg,#fff 0%,#7fd0ff 45%,#ff986f 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.hero-copy{max-width:680px;margin:24px 0 0;color:var(--muted);font-size:17px}.hero-side{padding:20px 0 2px;border-top:1px solid var(--line)}.hero-side strong{display:block;margin-bottom:7px;font-size:13px}.hero-side p{margin:0;color:var(--muted);font-size:13px}.hero-side a{display:inline-block;margin-top:13px;color:#8ed5ff;font-size:12px;text-decoration:none}.hero-side a:hover{text-decoration:underline}.statusbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 14px;color:var(--muted);font-size:12px}.statusbar p{margin:0}.refresh{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.025);color:#c8d9e5;font:inherit;cursor:pointer;transition:.2s ease}.refresh:hover{border-color:rgba(50,169,255,.5);color:#fff}.refresh:disabled{cursor:wait;opacity:.55}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card,.panel{position:relative;overflow:hidden;border:1px solid var(--line);background:linear-gradient(145deg,rgba(15,34,52,.84),rgba(7,18,29,.8));box-shadow:var(--shadow);backdrop-filter:blur(14px)}.card{min-height:174px;padding:23px;border-radius:17px}.card:before{position:absolute;inset:0;content:"";background:radial-gradient(circle at 90% 5%,rgba(50,169,255,.14),transparent 40%);pointer-events:none}.card:nth-child(2):before,.card:nth-child(4):before{background:radial-gradient(circle at 90% 5%,rgba(255,107,53,.12),transparent 42%)}.card-label{position:relative;color:#a9bdcb;font-size:12px;font-weight:700;letter-spacing:.045em;text-transform:uppercase}.card-value{position:relative;display:block;margin-top:25px;font-size:clamp(34px,5vw,50px);font-weight:720;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.055em}.card-note{position:relative;display:block;margin-top:12px;color:var(--muted);font-size:12px}.sections{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.panel{min-height:310px;padding:24px;border-radius:17px}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.panel h2{margin:0;font-size:17px;letter-spacing:-.025em}.panel-kicker{display:block;margin-top:3px;color:var(--muted);font-size:11px}.badge{padding:5px 8px;border:1px solid rgba(92,225,230,.18);border-radius:999px;background:rgba(92,225,230,.07);color:var(--cyan);font:700 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace;text-transform:uppercase}.row{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:11px 0;border-top:1px solid var(--line)}.row:first-child{border-top:0}.row span{color:#9db2c1;font-size:13px}.row strong{font-size:13px;font-variant-numeric:tabular-nums}.chart-item{margin:0 0 15px}.bar{height:5px;margin-top:7px;overflow:hidden;border-radius:999px;background:rgba(150,195,225,.1)}.bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--blue),var(--cyan));box-shadow:0 0 18px rgba(50,169,255,.4);transform-origin:left;animation:grow .8s cubic-bezier(.2,.8,.2,1) both}.chart-item:nth-child(even) .bar i{background:linear-gradient(90deg,var(--orange),#ffab75);box-shadow:0 0 18px rgba(255,107,53,.3)}.empty{padding:34px 0;color:var(--muted);font-size:13px;text-align:center}.privacy{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;margin-top:14px;padding:22px 24px;border:1px solid rgba(86,216,160,.17);border-radius:17px;background:rgba(86,216,160,.045)}.shield{display:grid;width:38px;height:38px;place-items:center;border:1px solid rgba(86,216,160,.25);border-radius:12px;background:rgba(86,216,160,.08);color:var(--green);font-size:18px}.privacy strong{font-size:13px}.privacy p{margin:4px 0 0;color:var(--muted);font-size:12px}.footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:28px;color:#677f91;font-size:11px}.footer a{color:#87a7bb;text-decoration:none}.footer a:hover{color:#fff}.error{color:#ff9b82}.skeleton{color:transparent!important;border-radius:7px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));background-size:220% 100%;animation:shimmer 1.5s infinite}@keyframes drift{to{transform:translate(70px,45px) scale(1.12)}}@keyframes pulse{50%{opacity:.45;box-shadow:0 0 0 8px rgba(86,216,160,0)}}@keyframes grow{from{transform:scaleX(0)}}@keyframes shimmer{to{background-position:-220% 0}}@media(max-width:820px){main{padding-top:52px}.hero{grid-template-columns:1fr;gap:28px}.metrics{grid-template-columns:1fr 1fr}.hero-side{max-width:520px}}@media(max-width:620px){.shell{width:min(100% - 24px,1160px)}.nav-meta .live{display:none}main{padding-top:42px}h1{font-size:45px}.hero-copy{font-size:15px}.metrics,.sections{grid-template-columns:1fr}.footer{align-items:flex-start;flex-direction:column}.card{min-height:150px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.orb,.live:before,.bar i,.skeleton{animation:none!important}}
  </style>
</head>
<body>
  <div class="backdrop"></div><div class="orb one"></div><div class="orb two"></div>
  <nav class="top"><div class="shell nav"><a class="brand" href="/"><span class="logo" aria-hidden="true"></span><span class="brand-text">OTNow</span></a><div class="nav-meta"><span class="live">Live aggregate data</span><a class="github" href="https://github.com/sil6428/OTNow">View on GitHub</a></div></div></nav>
  <main class="shell">
    <header class="hero"><div><p class="eyebrow">Community pulse</p><h1>Small signals.<br><span class="gradient">Useful momentum.</span></h1><p class="hero-copy">A transparent view of how consenting students use OTNow to keep their Canvas deadlines clear, current, and easier to act on.</p></div><aside class="hero-side"><strong>Anonymous by design</strong><p>These totals come only from installations that chose to participate. OTNow never collects coursework content or student identity.</p><a href="#privacy">See exactly what is excluded →</a></aside></header>
    <div class="statusbar"><p id="status" aria-live="polite">Loading the latest community totals…</p><button class="refresh" id="refresh" type="button">↻ Refresh</button></div>
    <section id="dashboard" aria-label="OTNow global statistics">
      <div id="metrics" class="metrics"><article class="card"><span class="card-label">Reporting installations</span><strong class="card-value skeleton">000</strong></article><article class="card"><span class="card-label">Canvas items organized</span><strong class="card-value skeleton">000</strong></article><article class="card"><span class="card-label">Reminders delivered</span><strong class="card-value skeleton">000</strong></article><article class="card"><span class="card-label">Changed dates caught</span><strong class="card-value skeleton">000</strong></article></div>
      <div class="sections"><section class="panel"><div class="panel-head"><div><h2>Reporting activity</h2><span class="panel-kicker">Recent participating installations</span></div><span class="badge">Live</span></div><div id="activity"><p class="empty">Loading activity…</p></div></section><section class="panel"><div class="panel-head"><div><h2>Canvas items organized</h2><span class="panel-kicker">Cumulative anonymous categories</span></div></div><div id="items"><p class="empty">Loading item totals…</p></div></section></div>
      <div class="sections"><section class="panel"><div class="panel-head"><div><h2>Version distribution</h2><span class="panel-kicker">Reporting installations by release</span></div></div><div id="versions"><p class="empty">Loading versions…</p></div></section><section class="panel"><div class="panel-head"><div><h2>Community growth</h2><span class="panel-kicker">New reporting installations · 30 days</span></div></div><div id="growth"><p class="empty">Loading growth…</p></div></section></div>
      <aside class="privacy" id="privacy"><span class="shield" aria-hidden="true">✓</span><div><strong>Numbers, never coursework.</strong><p>No names, emails, course names, assignment titles, URLs, grades, student numbers, Canvas identifiers, or IP addresses are stored. “Reporting installations” counts only users who explicitly enabled anonymous statistics, not every OTNow user.</p></div></aside>
    </section>
    <footer class="footer"><span>Built for Ontario Tech students · Independent and open source</span><span><a href="https://github.com/sil6428/OTNow/blob/main/PRIVACY.md">Privacy</a> · <a href="https://github.com/sil6428/OTNow/issues">Feedback</a></span></footer>
  </main>
  <script src="/dashboard.js"></script>
</body>
</html>`;

const DASHBOARD_JS = `const status=document.querySelector('#status'),refresh=document.querySelector('#refresh'),number=new Intl.NumberFormat(),compact=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1});const row=(label,value)=>{const div=document.createElement('div');div.className='row';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');b.textContent=number.format(Number(value)||0);div.append(a,b);return div};const metric=(label,value,note)=>{const article=document.createElement('article');article.className='card';const span=document.createElement('span');span.className='card-label';span.textContent=label;const strong=document.createElement('strong');strong.className='card-value';strong.textContent=compact.format(Number(value)||0);strong.title=number.format(Number(value)||0);const small=document.createElement('span');small.className='card-note';small.textContent=note;article.append(span,strong,small);return article};function bars(target,rows,labelKey,valueKey){target.replaceChildren();if(!rows.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No activity to show yet.';target.append(empty);return}const max=Math.max(1,...rows.map(x=>Number(x[valueKey])||0));for(const item of rows){const wrap=document.createElement('div');wrap.className='chart-item';const top=row(item[labelKey],item[valueKey]);const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('i');fill.style.width=((Number(item[valueKey])||0)/max*100)+'%';bar.append(fill);wrap.append(top,bar);target.append(wrap)}}async function load(){refresh.disabled=true;status.classList.remove('error');status.textContent='Refreshing anonymous community totals…';try{const response=await fetch('/api/stats',{cache:'no-store'});if(!response.ok)throw new Error('Statistics are temporarily unavailable.');const data=await response.json(),s=data.summary||{},a=data.activity||{};document.querySelector('#metrics').replaceChildren(metric('Reporting installations',s.reportingInstallations,'Opt-in devices contributing totals'),metric('Canvas items organized',s.totalItems,'Deadlines seen across participating installs'),metric('Reminders delivered',s.remindersSent,'Local notifications counted anonymously'),metric('Changed dates caught',s.movedDeadlines,'Deadline changes surfaced to students'));document.querySelector('#activity').replaceChildren(row('Active in the last 24 hours',a.active24h),row('Active in the last 7 days',a.active7d),row('Active in the last 30 days',a.active30d),row('Successful Canvas refreshes',s.successfulSyncs),row('Combined days used',s.activeDays));document.querySelector('#items').replaceChildren(row('Assignments',s.assignments),row('Quizzes',s.quizzes),row('Discussions',s.discussions),row('Events',s.events),row('Planner notes',s.notes),row('Other dated items',s.otherItems),row('Manual check-offs',s.manualCompletions));bars(document.querySelector('#versions'),data.versions||[],'version','installations');bars(document.querySelector('#growth'),data.newInstallations||[],'day','installs');status.textContent='Updated '+new Date(data.generatedAt).toLocaleString()}catch(error){status.classList.add('error');status.textContent=error.message}finally{refresh.disabled=false}}refresh.addEventListener('click',load);load();setInterval(load,300000)`;

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#06111f"/><rect x="15" y="15" width="34" height="34" rx="11" fill="none" stroke="#32a9ff" stroke-width="4" transform="rotate(45 32 32)"/><rect x="27" y="27" width="10" height="10" rx="3" fill="#ff6b35" transform="rotate(45 32 32)"/></svg>`;

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
      return json(await globalStats(env), 200, { "cache-control": "public, max-age=60, s-maxage=300" });
    }
    if ((url.pathname === "/" || url.pathname === "/dashboard") && request.method === "GET") return htmlResponse(DASHBOARD_HTML);
    if (url.pathname === "/dashboard.js" && request.method === "GET") return htmlResponse(DASHBOARD_JS, "text/javascript; charset=utf-8");
    if (url.pathname === "/favicon.svg" && request.method === "GET") return htmlResponse(FAVICON_SVG, "image/svg+xml; charset=utf-8");
    return json({ ok: false, error: "Not found" }, 404);
  },
  async scheduled(_controller, env) {
    await env.DB.prepare("DELETE FROM installations WHERE last_seen < datetime('now', '-180 days')").run();
  },
};
