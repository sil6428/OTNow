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

const ALLOWED_REPORT_KEYS = new Set(["schema", "installId", "version", "counters", "rating"]);
const ALLOWED_COUNTER_KEYS = new Set(COUNTER_KEYS);

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
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
  if (payload.rating != null && (!Number.isSafeInteger(payload.rating) || payload.rating < 1 || payload.rating > 5)) return false;
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
  const existing = await env.DB.prepare("SELECT last_seen, rating FROM installations WHERE id_hash = ?").bind(idHash).first();
  if (existing?.last_seen && Date.now() - parseSqliteTimestamp(existing.last_seen) < 15 * 60 * 1000) {
    if (payload.rating != null && payload.rating !== Number(existing.rating)) {
      await env.DB.prepare("UPDATE installations SET rating = ? WHERE id_hash = ?").bind(payload.rating, idHash).run();
      return json({ ok: true, accepted: true, ratingUpdated: true }, 202);
    }
    return json({ ok: true, accepted: false, reason: "recent-report" }, 202);
  }

  const values = payload.counters;
  await env.DB.prepare(`
    INSERT INTO installations (
      id_hash, first_seen, last_seen, version, total_items, assignments, quizzes,
      discussions, events, notes, other_items, reminders_sent, moved_deadlines,
      manual_completions, successful_syncs, active_days, rating, report_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
      rating = COALESCE(excluded.rating, installations.rating),
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
    payload.rating ?? null,
  ).run();

  let reportingPosition = null;
  if (!existing) {
    const total = await env.DB.prepare("SELECT COUNT(*) AS total FROM installations").first();
    reportingPosition = Number(total?.total) || null;
  }

  return json({ ok: true, accepted: true, reportingPosition }, 202);
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
        COALESCE(SUM(active_days), 0) AS activeDays,
        ROUND(AVG(rating), 1) AS averageRating,
        COUNT(rating) AS ratingCount
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

function statsCache() {
  return typeof caches === "undefined" ? null : caches.default;
}

function statsCacheKey(request) {
  return new Request(new URL("/api/stats", request.url), { method: "GET" });
}

async function publicStats(request, env, context) {
  const cache = statsCache();
  const key = statsCacheKey(request);
  const cached = cache ? await cache.match(key) : null;
  if (cached) return cached;
  const response = json(await globalStats(env), 200, { "cache-control": "public, max-age=60, s-maxage=300" });
  if (cache && context?.waitUntil) context.waitUntil(cache.put(key, response.clone()));
  return response;
}

function clearStatsCache(request, context) {
  const cache = statsCache();
  if (cache && context?.waitUntil) context.waitUntil(cache.delete(statsCacheKey(request)));
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Live, anonymous, opt-in usage statistics for OTNow.">
  <meta name="theme-color" content="#06111f">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>OTNow - Stats</title>
  <style>
    :root{color-scheme:dark;--bg:#030405;--surface:rgba(18,20,24,.68);--surface-strong:rgba(24,27,32,.9);--text:#f5f5f7;--muted:#9b9ba1;--line:rgba(255,255,255,.1);--blue:#55b8ff;--cyan:#8ce7ff;--orange:#ff7848;--green:#61d69a;--shadow:0 30px 100px rgba(0,0,0,.42)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{min-height:100vh;margin:0;overflow-x:hidden;background:var(--bg);color:var(--text);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}.backdrop{position:fixed;inset:0;z-index:-3;background:radial-gradient(circle at 50% -10%,#152636 0%,#080b0f 34%,#030405 70%)}.backdrop:before{position:absolute;inset:-35% -20% 48%;content:"";background:conic-gradient(from 210deg at 50% 100%,transparent 0deg,rgba(61,164,255,.28) 22deg,rgba(105,224,255,.06) 47deg,transparent 78deg,rgba(255,112,67,.2) 105deg,transparent 139deg);filter:blur(42px);mask-image:linear-gradient(to bottom,#000 25%,transparent 92%);animation:auroraShift 16s ease-in-out infinite alternate}.backdrop:after{position:absolute;inset:0;content:"";opacity:.13;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(to bottom,#000,transparent 66%)}.rays{position:fixed;top:-30vh;left:50%;z-index:-2;width:130vw;height:90vh;transform:translateX(-50%);background:repeating-conic-gradient(from 255deg at 50% 0%,rgba(105,203,255,.09) 0deg,transparent 5deg,transparent 13deg);filter:blur(3px);opacity:.6;mask-image:linear-gradient(to bottom,#000,transparent 78%);pointer-events:none;animation:raysBreathe 10s ease-in-out infinite}.shell{width:min(1180px,calc(100% - 48px));margin:auto}.top{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(3,4,5,.66);backdrop-filter:blur(24px) saturate(140%)}.nav{display:flex;min-height:64px;align-items:center;justify-content:space-between}.brand{display:inline-flex;align-items:center;gap:12px;color:#fff;font-size:17px;font-weight:700;letter-spacing:-.025em;text-decoration:none}.logo{position:relative;width:25px;height:25px;border:1.5px solid var(--blue);border-radius:8px;transform:rotate(45deg);box-shadow:0 0 28px rgba(85,184,255,.25)}.logo:after{position:absolute;width:7px;height:7px;inset:7.5px;content:"";border-radius:2px;background:var(--orange)}.brand-sub{color:#7e7e85;font-weight:500}.nav-meta{display:flex;align-items:center;gap:12px}.live{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid rgba(255,255,255,.08);border-radius:999px;color:#aaaab0;font-size:11px}.live:before{width:6px;height:6px;content:"";border-radius:50%;background:var(--green);box-shadow:0 0 12px rgba(97,214,154,.75);animation:livePulse 2.4s ease-in-out infinite}.github{padding:8px 13px;border-radius:999px;background:#f5f5f7;color:#0a0a0c;font-size:11px;font-weight:700;text-decoration:none;transition:transform .25s ease,box-shadow .25s ease}.github:hover{transform:translateY(-1px);box-shadow:0 8px 30px rgba(255,255,255,.14)}main{padding:84px 0 72px}.hero{display:grid;min-height:560px;grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr);gap:54px;align-items:center;padding:28px 0 82px}.eyebrow{display:inline-flex;align-items:center;gap:9px;margin:0 0 22px;color:#b8dcf5;font-size:11px;font-weight:650;letter-spacing:.14em;text-transform:uppercase}.eyebrow:before{width:27px;height:1px;content:"";background:linear-gradient(90deg,var(--blue),transparent)}h1{max-width:800px;margin:0;font-size:clamp(54px,7.4vw,90px);font-weight:650;line-height:.92;letter-spacing:-.075em}.hero-line{display:block}.gradient{padding-bottom:.06em;background:linear-gradient(105deg,#f9fbff 10%,#91d4ff 50%,#ff9a78 92%);-webkit-background-clip:text;background-clip:text;color:transparent}.hero-copy{max-width:610px;margin:28px 0 0;color:#929299;font-size:18px;letter-spacing:-.012em}.privacy-link{display:inline-flex;align-items:center;gap:8px;margin-top:24px;color:#d2d2d7;font-size:12px;text-decoration:none}.privacy-link:after{content:"→";transition:transform .2s ease}.privacy-link:hover:after{transform:translateX(4px)}.hero-visual{position:relative;display:grid;min-height:410px;place-items:center;perspective:900px}.display-orb{position:relative;display:grid;width:min(330px,78vw);aspect-ratio:1;place-items:center;border:1px solid rgba(255,255,255,.13);border-radius:50%;background:radial-gradient(circle at 36% 28%,rgba(255,255,255,.22),transparent 17%),radial-gradient(circle at 50% 65%,rgba(74,174,255,.28),transparent 50%),linear-gradient(145deg,rgba(45,52,62,.66),rgba(8,10,13,.82));box-shadow:inset -35px -45px 85px rgba(0,0,0,.5),inset 22px 18px 45px rgba(255,255,255,.05),0 55px 120px rgba(0,0,0,.55),0 0 100px rgba(68,169,255,.12);transform:rotateX(var(--orb-y,0deg)) rotateY(var(--orb-x,0deg));transition:transform .3s ease-out}.display-orb:before,.display-orb:after{position:absolute;content:"";border:1px solid rgba(121,204,255,.18);border-radius:50%;inset:-18px;animation:ringSpin 18s linear infinite}.display-orb:after{inset:-42px;border-color:rgba(255,126,79,.12);animation-duration:25s;animation-direction:reverse}.orb-value{font-size:clamp(70px,10vw,112px);font-weight:620;line-height:.82;letter-spacing:-.08em;text-shadow:0 0 35px rgba(106,199,255,.3)}.orb-label{position:absolute;bottom:25%;color:#9c9ca3;font-size:10px;font-weight:650;letter-spacing:.16em;text-transform:uppercase}.orbit-dot{position:absolute;top:7%;left:50%;width:9px;height:9px;border-radius:50%;background:var(--cyan);box-shadow:0 0 20px var(--blue);transform:translateX(-50%)}.statusbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 15px;color:#74747b;font-size:11px}.statusbar p{margin:0}.refresh{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.035);color:#c9c9ce;font:inherit;cursor:pointer;transition:.25s ease}.refresh:hover{border-color:rgba(255,255,255,.24);background:rgba(255,255,255,.07);color:#fff}.refresh:disabled{cursor:wait;opacity:.5}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card,.panel{position:relative;overflow:hidden;border:1px solid var(--line);background:linear-gradient(145deg,rgba(24,27,32,.76),rgba(10,11,14,.74));box-shadow:var(--shadow);backdrop-filter:blur(22px) saturate(130%)}.spotlight:after{position:absolute;inset:0;z-index:0;content:"";opacity:0;background:radial-gradient(440px circle at var(--mx,50%) var(--my,50%),rgba(101,191,255,.14),transparent 42%);transition:opacity .35s ease;pointer-events:none}.spotlight:hover:after{opacity:1}.spotlight>*{position:relative;z-index:1}.card{min-height:190px;padding:26px;border-radius:24px;transition:transform .32s cubic-bezier(.2,.8,.2,1),border-color .3s ease}.card:hover{border-color:rgba(255,255,255,.17);transform:translateY(-3px)}.card:nth-child(2n).spotlight:after{background:radial-gradient(440px circle at var(--mx,50%) var(--my,50%),rgba(255,120,72,.11),transparent 42%)}.card-label{color:#a1a1a7;font-size:11px;font-weight:650;letter-spacing:.06em;text-transform:uppercase}.card-value{display:block;margin-top:30px;font-size:clamp(42px,5vw,58px);font-weight:600;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.065em}.card-note{display:block;max-width:220px;margin-top:14px;color:#77777e;font-size:11px}.sections{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.panel{min-height:330px;padding:28px;border-radius:24px}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}.panel h2{margin:0;font-size:18px;font-weight:620;letter-spacing:-.035em}.panel-kicker{display:block;margin-top:4px;color:#74747c;font-size:11px}.badge{padding:6px 9px;border:1px solid rgba(140,231,255,.14);border-radius:999px;background:rgba(140,231,255,.055);color:#a7dcf2;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.row{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:12px 0;border-top:1px solid rgba(255,255,255,.075)}.row:first-child{border-top:0}.row span{color:#9999a0;font-size:12px}.row strong{font-size:12px;font-variant-numeric:tabular-nums}.chart-item{margin:0 0 16px}.bar{height:4px;margin-top:8px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.06)}.bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#369bf0,var(--cyan));box-shadow:0 0 20px rgba(85,184,255,.5);transform-origin:left;animation:barGrow .95s cubic-bezier(.2,.8,.2,1) both}.chart-item:nth-child(even) .bar i{background:linear-gradient(90deg,var(--orange),#ffb092);box-shadow:0 0 20px rgba(255,120,72,.35)}.empty{padding:38px 0;color:#73737a;font-size:12px;text-align:center}.signal-panel{min-height:0;margin-top:14px;padding:32px}.signal-field{display:grid;grid-template-columns:repeat(12,1fr);gap:11px;padding:12px 1px}.signal{position:relative;display:grid;aspect-ratio:1;place-items:center;border:1px solid rgba(255,255,255,.06);border-radius:15px;background:rgba(255,255,255,.015);transition:transform .3s ease,border-color .3s ease}.signal:after{width:6px;height:6px;content:"";border-radius:50%;background:rgba(255,255,255,.09)}.signal.active{border-color:rgba(85,184,255,.17);background:radial-gradient(circle,rgba(85,184,255,.12),transparent 68%)}.signal.active:after{background:var(--cyan);box-shadow:0 0 18px rgba(85,184,255,.9);animation:signalGlow 2.8s ease-in-out infinite}.signal.active:nth-child(3n):after{background:#ff9a78;box-shadow:0 0 18px rgba(255,120,72,.8);animation-delay:-.9s}.signal.active:hover{z-index:2;border-color:rgba(140,231,255,.38);transform:scale(1.08)}.signal-copy{margin:15px 0 0;color:#74747b;font-size:11px}.privacy{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start;margin-top:14px;padding:24px 26px;border:1px solid rgba(97,214,154,.13);border-radius:20px;background:rgba(97,214,154,.035)}.shield{display:grid;width:38px;height:38px;place-items:center;border:1px solid rgba(97,214,154,.2);border-radius:50%;background:rgba(97,214,154,.07);color:var(--green);font-size:16px}.privacy strong{font-size:12px}.privacy p{margin:5px 0 0;color:#77777e;font-size:11px}.footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:34px;color:#55555b;font-size:10px}.footer a{color:#85858c;text-decoration:none}.footer a:hover{color:#fff}.error{color:#ff997b}.skeleton{color:transparent!important;border-radius:9px;background:linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.09),rgba(255,255,255,.03));background-size:220% 100%;animation:shimmer 1.5s infinite}.motion-ready .hero-reveal{opacity:0;filter:blur(14px);transform:translateY(24px)}.motion-ready.loaded .hero-reveal{opacity:1;filter:blur(0);transform:none;transition:opacity .9s cubic-bezier(.2,.8,.2,1) var(--delay,0s),filter .9s cubic-bezier(.2,.8,.2,1) var(--delay,0s),transform .9s cubic-bezier(.2,.8,.2,1) var(--delay,0s)}.motion-ready .reveal{opacity:0;filter:blur(9px);transform:translateY(28px);transition:opacity .75s ease,filter .75s ease,transform .75s cubic-bezier(.2,.8,.2,1)}.motion-ready .reveal.visible{opacity:1;filter:blur(0);transform:none}@keyframes auroraShift{to{transform:translate3d(7%,5%,0) scale(1.08);filter:blur(55px) hue-rotate(12deg)}}@keyframes raysBreathe{50%{opacity:.34;transform:translateX(-50%) scaleX(.95)}}@keyframes ringSpin{to{transform:rotate(360deg)}}@keyframes livePulse{50%{opacity:.45;box-shadow:0 0 0 7px rgba(97,214,154,0)}}@keyframes signalGlow{50%{opacity:.35;transform:scale(.68)}}@keyframes barGrow{from{transform:scaleX(0)}}@keyframes shimmer{to{background-position:-220% 0}}@media(max-width:900px){main{padding-top:52px}.hero{grid-template-columns:1fr;gap:24px;padding-bottom:64px}.hero-visual{min-height:370px}.metrics{grid-template-columns:1fr 1fr}.signal-field{grid-template-columns:repeat(8,1fr)}}@media(max-width:620px){.shell{width:min(100% - 24px,1180px)}.nav-meta .live{display:none}.brand-sub{display:none}main{padding-top:38px}.hero{min-height:0;padding-bottom:52px}h1{font-size:clamp(47px,15vw,62px)}.hero-copy{font-size:15px}.hero-visual{min-height:320px}.display-orb{width:min(270px,75vw)}.metrics,.sections{grid-template-columns:1fr}.card{min-height:164px}.panel{padding:23px}.signal-field{grid-template-columns:repeat(6,1fr);gap:8px}.footer{align-items:flex-start;flex-direction:column}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.backdrop:before,.rays,.display-orb:before,.display-orb:after,.live:before,.bar i,.signal.active:after,.skeleton{animation:none!important}.motion-ready .hero-reveal,.motion-ready .reveal{opacity:1!important;filter:none!important;transform:none!important;transition:none!important}.display-orb{transform:none!important}.card:hover,.signal.active:hover{transform:none}}
  </style>
</head>
<body>
  <div class="backdrop"></div><div class="rays"></div>
  <nav class="top"><div class="shell nav"><a class="brand" href="/"><span class="logo" aria-hidden="true"></span><span>OTNow <span class="brand-sub">Stats</span></span></a><div class="nav-meta"><span class="live">Live · opt-in only</span><a class="github" href="https://github.com/sil6428/OTNow">GitHub</a></div></div></nav>
  <main class="shell">
    <header class="hero"><div><p class="eyebrow hero-reveal" style="--delay:.05s">Community pulse</p><h1><span class="hero-line hero-reveal" style="--delay:.12s">Small signals.</span><span class="hero-line gradient hero-reveal" style="--delay:.2s">Real momentum.</span></h1><p class="hero-copy hero-reveal" style="--delay:.3s">A calm, transparent view of how consenting students use OTNow to keep Canvas deadlines current and easier to act on.</p><a class="privacy-link hero-reveal" style="--delay:.38s" href="#privacy">Anonymous by design</a></div><div class="hero-visual hero-reveal" style="--delay:.18s"><div class="display-orb" id="display-orb"><span class="orbit-dot"></span><strong class="orb-value" id="hero-count">0</strong><span class="orb-label">reporting signals</span></div></div></header>
    <div class="statusbar"><p id="status" aria-live="polite">Loading the latest community totals…</p><button class="refresh" id="refresh" type="button">↻ Refresh</button></div>
    <section id="dashboard" aria-label="OTNow global statistics">
      <div id="metrics" class="metrics reveal"><article class="card spotlight"><span class="card-label">Reporting installations</span><strong class="card-value skeleton">000</strong></article><article class="card spotlight"><span class="card-label">Canvas items organized</span><strong class="card-value skeleton">000</strong></article><article class="card spotlight"><span class="card-label">Reminders delivered</span><strong class="card-value skeleton">000</strong></article><article class="card spotlight"><span class="card-label">Changed dates caught</span><strong class="card-value skeleton">000</strong></article></div>
      <div class="sections reveal"><section class="panel spotlight"><div class="panel-head"><div><h2>Reporting activity</h2><span class="panel-kicker">Recent participating installations</span></div><span class="badge">Live</span></div><div id="activity"><p class="empty">Loading activity…</p></div></section><section class="panel spotlight"><div class="panel-head"><div><h2>Canvas items organized</h2><span class="panel-kicker">Cumulative anonymous categories</span></div></div><div id="items"><p class="empty">Loading item totals…</p></div></section></div>
      <div class="sections reveal"><section class="panel spotlight"><div class="panel-head"><div><h2>Version distribution</h2><span class="panel-kicker">Reporting installations by release</span></div></div><div id="versions"><p class="empty">Loading versions…</p></div></section><section class="panel spotlight"><div class="panel-head"><div><h2>Community growth</h2><span class="panel-kicker">New reporting installations · 30 days</span></div></div><div id="growth"><p class="empty">Loading growth…</p></div></section></div>
      <aside class="privacy reveal" id="privacy"><span class="shield" aria-hidden="true">✓</span><div><strong>Numbers, never coursework.</strong><p>No names, emails, course names, assignment titles, URLs, grades, student numbers, Canvas identifiers, or IP addresses are stored. “Reporting installations” counts only users who explicitly enabled anonymous statistics, not every OTNow user.</p></div></aside>
    </section>
    <footer class="footer"><span>Built for Ontario Tech students · Independent and open source</span><span><a href="https://github.com/sil6428/OTNow/blob/main/PRIVACY.md">Privacy</a> · <a href="https://github.com/sil6428/OTNow/issues">Feedback</a> · Motion inspired by <a href="https://reactbits.dev">React Bits</a></span></footer>
  </main>
  <script src="/dashboard.js"></script>
</body>
</html>`;

const DASHBOARD_JS = `
const status = document.querySelector('#status');
const refresh = document.querySelector('#refresh');
const heroCount = document.querySelector('#hero-count');
const displayOrb = document.querySelector('#display-orb');
const number = new Intl.NumberFormat();
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function row(label, value) {
  const div = document.createElement('div');
  div.className = 'row';
  const name = document.createElement('span');
  name.textContent = label;
  const total = document.createElement('strong');
  total.textContent = number.format(Number(value) || 0);
  div.append(name, total);
  return div;
}

function animateNumber(element, value, formatter = compact) {
  const target = Math.max(0, Number(value) || 0);
  element.title = number.format(target);
  if (reducedMotion || target === 0) {
    element.textContent = formatter.format(target);
    return;
  }
  const started = performance.now();
  const duration = 900;
  function frame(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    element.textContent = formatter.format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function metric(label, value, note) {
  const article = document.createElement('article');
  article.className = 'card spotlight';
  const name = document.createElement('span');
  name.className = 'card-label';
  name.textContent = label;
  const total = document.createElement('strong');
  total.className = 'card-value';
  total.textContent = '0';
  const detail = document.createElement('span');
  detail.className = 'card-note';
  detail.textContent = note;
  article.append(name, total, detail);
  animateNumber(total, value);
  return article;
}

function bars(target, rows, labelKey, valueKey) {
  target.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No activity to show yet.';
    target.append(empty);
    return;
  }
  const max = Math.max(1, ...rows.map((item) => Number(item[valueKey]) || 0));
  for (const item of rows) {
    const wrap = document.createElement('div');
    wrap.className = 'chart-item';
    const top = row(item[labelKey], item[valueKey]);
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.width = ((Number(item[valueKey]) || 0) / max * 100) + '%';
    bar.append(fill);
    wrap.append(top, bar);
    target.append(wrap);
  }
}

function setupMotion() {
  document.body.classList.add('motion-ready');
  requestAnimationFrame(() => document.body.classList.add('loaded'));
  if (!('IntersectionObserver' in window) || reducedMotion) {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.13 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}

document.addEventListener('pointermove', (event) => {
  if (!(event.target instanceof Element)) return;
  const card = event.target.closest('.spotlight');
  if (card) {
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--mx', (event.clientX - bounds.left) + 'px');
    card.style.setProperty('--my', (event.clientY - bounds.top) + 'px');
  }
  if (!reducedMotion && displayOrb) {
    const x = (event.clientX / innerWidth - .5) * 7;
    const y = (event.clientY / innerHeight - .5) * -7;
    displayOrb.style.setProperty('--orb-x', x + 'deg');
    displayOrb.style.setProperty('--orb-y', y + 'deg');
  }
});

async function load() {
  refresh.disabled = true;
  status.classList.remove('error');
  status.textContent = 'Refreshing anonymous community totals…';
  try {
    const response = await fetch('/api/stats', { cache: 'no-store' });
    if (!response.ok) throw new Error('Statistics are temporarily unavailable.');
    const data = await response.json();
    const summary = data.summary || {};
    const activity = data.activity || {};
    document.querySelector('#metrics').replaceChildren(
      metric('Reporting installations', summary.reportingInstallations, 'Opt-in devices contributing totals'),
      metric('Canvas items organized', summary.totalItems, 'Deadlines seen across participating installs'),
      metric('Reminders delivered', summary.remindersSent, 'Local notifications counted anonymously'),
      metric('Changed dates caught', summary.movedDeadlines, 'Deadline changes surfaced to students'),
    );
    document.querySelector('#activity').replaceChildren(
      row('Active in the last 24 hours', activity.active24h),
      row('Active in the last 7 days', activity.active7d),
      row('Active in the last 30 days', activity.active30d),
      row('Successful Canvas refreshes', summary.successfulSyncs),
      row('Combined days used', summary.activeDays),
    );
    document.querySelector('#items').replaceChildren(
      row('Assignments', summary.assignments),
      row('Quizzes', summary.quizzes),
      row('Discussions', summary.discussions),
      row('Events', summary.events),
      row('Planner notes', summary.notes),
      row('Other dated items', summary.otherItems),
      row('Manual check-offs', summary.manualCompletions),
    );
    bars(document.querySelector('#versions'), data.versions || [], 'version', 'installations');
    bars(document.querySelector('#growth'), data.newInstallations || [], 'day', 'installs');
    animateNumber(heroCount, summary.reportingInstallations, number);
    status.textContent = 'Updated ' + new Date(data.generatedAt).toLocaleString();
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  } finally {
    refresh.disabled = false;
  }
}

setupMotion();
refresh.addEventListener('click', load);
load();
setInterval(load, 300000);
`;

const MINIMAL_DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="A live, minimal view of OTNow's anonymous opt-in community totals.">
  <meta name="theme-color" content="#05070a">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>OTNow - Stats</title>
  <style>
    :root{color-scheme:dark;--bg:#05070a;--text:#f7f8fa;--muted:#858b94;--line:rgba(255,255,255,.12);--blue:#58baff;--orange:#ff7148;--green:#63daa1}
    *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{background:var(--bg);color:var(--text);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit}#field{position:fixed;inset:0;width:100%;height:100%;opacity:.88}.wash{position:fixed;inset:0;pointer-events:none;background:radial-gradient(700px circle at var(--x,50%) var(--y,45%),rgba(58,164,239,.12),transparent 55%),linear-gradient(180deg,rgba(4,6,9,.04),rgba(4,6,9,.68));transition:background .08s linear}.stage{position:relative;z-index:1;display:grid;width:min(1040px,calc(100% - 56px));height:100%;margin:auto;grid-template-rows:auto 1fr auto}.top{display:flex;align-items:center;justify-content:space-between;padding:24px 0}.brand{display:inline-flex;align-items:center;gap:10px;font-size:13px;font-weight:720;letter-spacing:-.015em;text-decoration:none}.mark{position:relative;width:20px;height:20px;border:1.5px solid var(--blue);border-radius:6px;transform:rotate(45deg);box-shadow:0 0 24px rgba(88,186,255,.25)}.mark:after{position:absolute;inset:6px;content:"";border-radius:2px;background:var(--orange)}.links{display:flex;align-items:center;gap:18px;color:var(--muted);font-size:11px}.links a{text-decoration:none;transition:color .2s ease}.links a:hover{color:#fff}.live{display:inline-flex;align-items:center;gap:7px}.live:before{width:5px;height:5px;content:"";border-radius:50%;background:var(--green);box-shadow:0 0 13px rgba(99,218,161,.8)}main{display:grid;align-content:center;justify-items:start;padding-bottom:2vh}.eyebrow{margin:0 0 15px;color:#99a1ab;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}h1{max-width:720px;margin:0;font-size:clamp(49px,7.1vw,84px);font-weight:610;line-height:.94;letter-spacing:-.067em}.accent{background:linear-gradient(100deg,#fff 12%,#9ddaff 58%,#ff9a7a);-webkit-background-clip:text;background-clip:text;color:transparent}.lede{max-width:590px;margin:22px 0 36px;color:var(--muted);font-size:15px;letter-spacing:-.012em}.stats{display:grid;width:min(820px,100%);grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.stat{position:relative;min-width:0;padding:19px 22px 17px 0}.stat+.stat{padding-left:22px;border-left:1px solid var(--line)}.value{display:block;overflow:hidden;font-size:clamp(28px,4vw,43px);font-weight:620;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.055em;text-overflow:ellipsis;white-space:nowrap}.label{display:block;margin-top:9px;color:#8e949d;font-size:9px;font-weight:690;letter-spacing:.11em;text-transform:uppercase}.rating-note{margin-left:5px;color:#68707a;font-size:9px;font-weight:500;letter-spacing:0;text-transform:none}.meta{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:19px 0 22px;color:#626872;font-size:9px}.meta-left{display:flex;align-items:center;gap:14px}.meta a{text-decoration:none}.meta a:hover{color:#fff}.privacy{max-width:565px}.error{color:#ff9c83}.enter{opacity:0;filter:blur(11px);transform:translateY(15px);animation:enter .8s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--delay,0s)}@keyframes enter{to{opacity:1;filter:blur(0);transform:none}}@media(max-width:720px){.stage{width:min(100% - 30px,1040px)}.top{padding:18px 0}.links{gap:12px}.links .optional{display:none}main{padding-bottom:0}.eyebrow{margin-bottom:10px}h1{font-size:clamp(42px,13vw,66px)}.lede{margin:16px 0 25px;font-size:13px}.stats{grid-template-columns:1fr 1fr}.stat{padding:14px 14px 13px 0}.stat+.stat{padding-left:14px}.stat:nth-child(3){padding-left:0;border-left:0;border-top:1px solid var(--line)}.stat:nth-child(4){border-top:1px solid var(--line)}.value{font-size:30px}.meta{align-items:flex-start;flex-direction:column-reverse;padding:14px 0 16px;gap:7px}.privacy{max-width:100%;font-size:8px}}@media(max-height:650px) and (min-width:721px){.top{padding:15px 0}h1{font-size:56px}.lede{margin:14px 0 25px}.stat{padding-top:14px;padding-bottom:13px}.meta{padding:12px 0 14px}}@media(prefers-reduced-motion:reduce){.enter{opacity:1;filter:none;transform:none;animation:none}.wash{transition:none}}
  </style>
</head>
<body>
  <canvas id="field" aria-hidden="true"></canvas><div class="wash" aria-hidden="true"></div>
  <div class="stage">
    <header class="top"><a class="brand" href="/"><span class="mark"></span><span>OTNow · Stats</span></a><nav class="links"><span class="live">live totals</span><a class="optional" href="https://github.com/sil6428/OTNow/blob/main/PRIVACY.md">privacy</a><a href="https://github.com/sil6428/OTNow">github ↗</a></nav></header>
    <main>
      <p class="eyebrow enter" style="--delay:.04s">Anonymous community totals</p>
      <h1 class="enter" style="--delay:.11s">Less deadline noise.<br><span class="accent">More time to move.</span></h1>
      <p class="lede enter" style="--delay:.2s">A small public snapshot of what consenting students have organized with OTNow. Broad numbers only—never coursework.</p>
      <section class="stats enter" style="--delay:.28s" aria-label="OTNow global statistics">
        <div class="stat"><strong class="value" data-stat="reportingInstallations">0</strong><span class="label">reporting users</span></div>
        <div class="stat"><strong class="value" data-stat="totalItems">0</strong><span class="label">items organized</span></div>
        <div class="stat"><strong class="value" data-stat="remindersSent">0</strong><span class="label">reminders delivered</span></div>
        <div class="stat"><strong class="value" data-stat="averageRating">—</strong><span class="label">community rating <span class="rating-note" id="rating-count"></span></span></div>
      </section>
    </main>
    <footer class="meta enter" style="--delay:.36s"><span class="privacy">Opt-in reporting only. No names, emails, courses, titles, grades, URLs, Canvas IDs, or IP addresses are stored.</span><span class="meta-left"><span id="status">loading totals…</span><a href="https://github.com/sil6428/OTNow/issues">feedback</a><a href="https://reactbits.dev">motion inspiration</a></span></footer>
  </div>
  <script src="/dashboard.js"></script>
</body></html>`;

const MINIMAL_DASHBOARD_JS = `
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: true });
const status = document.querySelector('#status');
const pointer = { x: innerWidth * .58, y: innerHeight * .43 };
const number = new Intl.NumberFormat();
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
let points = [];
let scale = 1;

function resize() {
  scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  context.setTransform(scale, 0, 0, scale, 0, 0);
  points = [];
  const gap = innerWidth < 700 ? 34 : 42;
  for (let y = gap / 2; y < innerHeight; y += gap) {
    for (let x = gap / 2; x < innerWidth; x += gap) points.push({ x: x, y: y, seed: Math.random() * Math.PI * 2 });
  }
}

function draw(time) {
  context.clearRect(0, 0, innerWidth, innerHeight);
  const t = reducedMotion ? 0 : time * .00035;
  for (const point of points) {
    const driftX = Math.sin(t + point.seed) * 2.2;
    const driftY = Math.cos(t * .8 + point.seed) * 2.2;
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const influence = Math.max(0, 1 - distance / 210);
    const push = influence * 13;
    const x = point.x + driftX + (distance ? dx / distance * push : 0);
    const y = point.y + driftY + (distance ? dy / distance * push : 0);
    const warm = ((point.x + point.y) / 120) % 8 < 1;
    context.beginPath();
    context.arc(x, y, .8 + influence * 1.5, 0, Math.PI * 2);
    context.fillStyle = warm ? 'rgba(255,113,72,' + (.1 + influence * .52) + ')' : 'rgba(120,199,255,' + (.08 + influence * .52) + ')';
    context.fill();
  }
  if (!reducedMotion) requestAnimationFrame(draw);
}

function animateNumber(element, value) {
  const target = Math.max(0, Number(value) || 0);
  element.title = number.format(target);
  if (reducedMotion || target === 0) {
    element.textContent = compact.format(target);
    return;
  }
  const start = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - start) / 820);
    const eased = 1 - Math.pow(1 - progress, 4);
    element.textContent = compact.format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

async function load() {
  status.classList.remove('error');
  try {
    const response = await fetch('/api/stats', { cache: 'no-store' });
    if (!response.ok) throw new Error('stats unavailable');
    const data = await response.json();
    const summary = data.summary || {};
    for (const element of document.querySelectorAll('[data-stat]')) {
      const key = element.dataset.stat;
      if (key === 'averageRating') element.textContent = summary.ratingCount ? Number(summary.averageRating).toFixed(1) + ' ★' : '—';
      else animateNumber(element, summary[key]);
    }
    const count = Number(summary.ratingCount) || 0;
    document.querySelector('#rating-count').textContent = count ? '(' + number.format(count) + ')' : '(not yet rated)';
    status.textContent = 'updated ' + new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
  }
}

addEventListener('resize', resize);
addEventListener('pointermove', function (event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  document.documentElement.style.setProperty('--x', event.clientX + 'px');
  document.documentElement.style.setProperty('--y', event.clientY + 'px');
});
resize();
draw(0);
load();
setInterval(load, 300000);
`;

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
  async fetch(request, env, context) {
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
    if (url.pathname === "/api/report" && request.method === "POST") {
      const response = await report(request, env);
      clearStatsCache(request, context);
      return response;
    }
    if (url.pathname === "/api/report" && request.method === "DELETE") {
      const response = await removeReport(request, env);
      clearStatsCache(request, context);
      return response;
    }
    if (url.pathname === "/api/stats" && request.method === "GET") return publicStats(request, env, context);
    if ((url.pathname === "/" || url.pathname === "/dashboard") && request.method === "GET") return htmlResponse(MINIMAL_DASHBOARD_HTML);
    if (url.pathname === "/dashboard.js" && request.method === "GET") return htmlResponse(MINIMAL_DASHBOARD_JS, "text/javascript; charset=utf-8");
    if (url.pathname === "/favicon.svg" && request.method === "GET") return htmlResponse(FAVICON_SVG, "image/svg+xml; charset=utf-8");
    return json({ ok: false, error: "Not found" }, 404);
  },
  async scheduled(_controller, env) {
    await env.DB.prepare("DELETE FROM installations WHERE last_seen < datetime('now', '-180 days')").run();
  },
};
