const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfvZY5paIPzJv8adIeHdkpgwzXldEqnMhM4Zbp2_c8kg7dqXw/viewform";

export const DASHBOARD_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="Anonymous, opt-in OTNow usage totals and community rating.">
  <meta name="theme-color" content="#05070a">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>OTNow - Stats</title>
  <style>
    :root{color-scheme:dark;--bg:#05070a;--text:#f7f8fa;--muted:#8c929c;--line:rgba(255,255,255,.12);--blue:#58baff;--orange:#ff7148;--green:#63daa1}
    *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{background:var(--bg);color:var(--text);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}button{font:inherit}a{color:inherit}#field{position:fixed;inset:0;width:100%;height:100%;opacity:.72}.wash{position:fixed;inset:0;pointer-events:none;background:radial-gradient(660px circle at var(--x,50%) var(--y,45%),rgba(58,164,239,.11),transparent 58%),linear-gradient(180deg,rgba(4,6,9,.06),rgba(4,6,9,.76));transition:background .08s linear}.stage{position:relative;z-index:1;display:grid;width:min(1000px,calc(100% - 56px));height:100%;margin:auto;grid-template-rows:auto 1fr auto}.top{display:flex;align-items:center;justify-content:space-between;padding:24px 0}.brand{display:inline-flex;align-items:center;gap:10px;font-size:13px;font-weight:720;letter-spacing:-.015em;text-decoration:none}.mark{position:relative;width:20px;height:20px;border:1.5px solid var(--blue);border-radius:6px;transform:rotate(45deg);box-shadow:0 0 24px rgba(88,186,255,.25)}.mark:after{position:absolute;inset:6px;content:"";border-radius:2px;background:var(--orange)}.links{display:flex;align-items:center;gap:18px;color:var(--muted);font-size:11px}.links a{text-decoration:none;transition:color .2s ease}.links a:hover{color:#fff}.live{display:inline-flex;align-items:center;gap:7px}.live:before{width:5px;height:5px;content:"";border-radius:50%;background:var(--green);box-shadow:0 0 13px rgba(99,218,161,.8)}main{display:grid;align-content:center;justify-items:start;padding-bottom:1vh}.eyebrow{margin:0 0 10px;color:#99a1ab;font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}h1{max-width:720px;margin:0;font-size:clamp(34px,4.5vw,52px);font-weight:610;line-height:1.04;letter-spacing:-.045em}.lede{max-width:650px;margin:14px 0 30px;color:var(--muted);font-size:14px;letter-spacing:-.008em}.stats{display:grid;width:min(860px,100%);grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.stat{position:relative;min-width:0;padding:19px 22px 17px 0;isolation:isolate}.stat+.stat{padding-left:22px;border-left:1px solid var(--line)}.stat:before{position:absolute;inset:0;z-index:-1;content:"";opacity:0;background:radial-gradient(230px circle at var(--mx,50%) var(--my,50%),rgba(88,186,255,.12),transparent 67%);transition:opacity .25s}.stat:hover:before{opacity:1}.value{display:block;overflow:hidden;font-size:clamp(28px,4vw,43px);font-weight:620;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.055em;text-overflow:ellipsis;white-space:nowrap}.label{display:block;margin-top:9px;color:#8e949d;font-size:9px;font-weight:690;letter-spacing:.11em;text-transform:uppercase}.rating-note{margin-left:5px;color:#68707a;font-size:9px;font-weight:500;letter-spacing:0;text-transform:none}.stars{display:flex;gap:3px;margin-top:8px}.star{position:relative;display:grid;width:22px;height:22px;padding:0;place-items:center;border:0;background:transparent;color:#505762;font-size:18px;line-height:1;cursor:pointer;transition:color .16s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.star:hover,.star:focus-visible,.star.on{color:#77c8ff;transform:translateY(-1px) scale(1.08)}.star:focus-visible{outline:1px solid var(--blue);outline-offset:2px;border-radius:4px}.rating-hint{position:absolute;right:20px;bottom:18px;color:#69717c;font-size:8px}.meta{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:19px 0 22px;color:#626872;font-size:9px}.meta-left{display:flex;align-items:center;gap:14px}.meta a{text-decoration:none}.meta a:hover{color:#fff}.privacy{max-width:590px}.error{color:#ff9c83}.enter{opacity:0;filter:blur(8px);transform:translateY(10px);animation:enter .65s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--delay,0s)}@keyframes enter{to{opacity:1;filter:blur(0);transform:none}}.spark{position:fixed;z-index:20;width:5px;height:5px;border-radius:50%;background:var(--blue);pointer-events:none;animation:spark .48s cubic-bezier(.2,.8,.2,1) forwards}@keyframes spark{to{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.2)}}
    @media(max-width:760px){.stage{width:min(100% - 30px,1000px)}.top{padding:18px 0}.links{gap:12px}.links .optional{display:none}main{padding-bottom:0}h1{font-size:clamp(31px,9vw,42px)}.lede{margin:12px 0 22px;font-size:12px}.stats{grid-template-columns:1fr 1fr}.stat{padding:14px 14px 13px 0}.stat+.stat{padding-left:14px}.stat:nth-child(3){padding-left:0;border-left:0;border-top:1px solid var(--line)}.stat:nth-child(4){border-top:1px solid var(--line)}.value{font-size:30px}.rating-hint{display:none}.meta{align-items:flex-start;flex-direction:column-reverse;padding:14px 0 16px;gap:7px}.privacy{max-width:100%;font-size:8px}}@media(max-height:650px) and (min-width:761px){.top{padding:15px 0}h1{font-size:38px}.lede{margin:10px 0 21px}.stat{padding-top:13px;padding-bottom:12px}.meta{padding:11px 0 13px}.stars{margin-top:5px}}@media(prefers-reduced-motion:reduce){.enter{opacity:1;filter:none;transform:none;animation:none}.wash{transition:none}.spark{display:none}}
  </style>
</head>
<body>
  <canvas id="field" aria-hidden="true"></canvas><div class="wash" aria-hidden="true"></div>
  <div class="stage">
    <header class="top"><a class="brand" href="/"><span class="mark"></span><span>OTNow · Stats</span></a><nav class="links"><span class="live">live totals</span><a href="${FEEDBACK_FORM_URL}" target="_blank" rel="noopener">leave feedback ↗</a><a class="optional" href="https://github.com/sil6428/OTNow/blob/main/PRIVACY.md">privacy</a><a href="https://github.com/sil6428/OTNow">github ↗</a></nav></header>
    <main>
      <p class="eyebrow enter" style="--delay:.04s">OTNow statistics</p>
      <h1 class="enter" style="--delay:.11s">Anonymous usage totals</h1>
      <p class="lede enter" style="--delay:.18s">Aggregate numbers from installations that opted in. Coursework and account information stay on each student's device.</p>
      <section class="stats enter" style="--delay:.28s" aria-label="OTNow global statistics">
        <div class="stat"><strong class="value" data-stat="reportingInstallations">0</strong><span class="label">reporting users</span></div>
        <div class="stat"><strong class="value" data-stat="totalItems">0</strong><span class="label">items organized</span></div>
        <div class="stat"><strong class="value" data-stat="remindersSent">0</strong><span class="label">reminders delivered</span></div>
        <div class="stat"><strong class="value" data-stat="averageRating">—</strong><span class="label">community rating <span class="rating-note" id="rating-count"></span></span><div class="stars" id="quick-rating" role="radiogroup" aria-label="Rate OTNow"><button class="star" type="button" data-rating="1" aria-label="1 star">★</button><button class="star" type="button" data-rating="2" aria-label="2 stars">★</button><button class="star" type="button" data-rating="3" aria-label="3 stars">★</button><button class="star" type="button" data-rating="4" aria-label="4 stars">★</button><button class="star" type="button" data-rating="5" aria-label="5 stars">★</button></div><span class="rating-hint" id="rating-hint">rate it</span></div>
      </section>
    </main>
    <footer class="meta enter" style="--delay:.36s"><span class="privacy">Usage reports and site ratings contain no names, emails, coursework, grades, URLs, Canvas IDs, or IP addresses. Written feedback uses a separate Google Form.</span><span class="meta-left"><span id="status">loading totals…</span><a href="${FEEDBACK_FORM_URL}" target="_blank" rel="noopener">feedback form</a><a href="https://reactbits.dev">motion inspiration</a></span></footer>
  </div>
  <script src="/dashboard.js"></script>
</body></html>`;

export const DASHBOARD_SCRIPT = String.raw`
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
  for (let y = gap / 2; y < innerHeight; y += gap) for (let x = gap / 2; x < innerWidth; x += gap) points.push({ x: x, y: y, seed: Math.random() * Math.PI * 2 });
}

function draw(time) {
  context.clearRect(0, 0, innerWidth, innerHeight);
  const t = reducedMotion ? 0 : time * .00035;
  for (const point of points) {
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const influence = Math.max(0, 1 - distance / 210);
    const push = influence * 13;
    const x = point.x + Math.sin(t + point.seed) * 2.2 + (distance ? dx / distance * push : 0);
    const y = point.y + Math.cos(t * .8 + point.seed) * 2.2 + (distance ? dy / distance * push : 0);
    context.beginPath();
    context.arc(x, y, .8 + influence * 1.5, 0, Math.PI * 2);
    const warm = ((point.x + point.y) / 120) % 8 < 1;
    context.fillStyle = warm ? 'rgba(255,113,72,' + (.1 + influence * .52) + ')' : 'rgba(120,199,255,' + (.08 + influence * .52) + ')';
    context.fill();
  }
  if (!reducedMotion) requestAnimationFrame(draw);
}

function animateNumber(element, value) {
  const target = Math.max(0, Number(value) || 0);
  element.title = number.format(target);
  if (reducedMotion || target === 0) { element.textContent = compact.format(target); return; }
  const start = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - start) / 820);
    element.textContent = compact.format(Math.round(target * (1 - Math.pow(1 - progress, 4))));
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
  } catch (error) { status.classList.add('error'); status.textContent = error.message; }
}

function paintStars(rating) {
  for (const button of document.querySelectorAll('#quick-rating .star')) button.classList.toggle('on', Number(button.dataset.rating) <= rating);
}

function spark(event) {
  if (reducedMotion) return;
  for (let index = 0; index < 7; index += 1) {
    const particle = document.createElement('i');
    particle.className = 'spark';
    particle.style.left = event.clientX + 'px';
    particle.style.top = event.clientY + 'px';
    const angle = Math.PI * 2 * index / 7;
    const radius = 19 + Math.random() * 11;
    particle.style.setProperty('--dx', Math.cos(angle) * radius + 'px');
    particle.style.setProperty('--dy', Math.sin(angle) * radius + 'px');
    document.body.append(particle);
    particle.addEventListener('animationend', function () { particle.remove(); });
  }
}

async function quickRate(rating, event) {
  const previous = Number(localStorage.getItem('otnowSiteRating')) || 0;
  if (previous) { document.querySelector('#rating-hint').textContent = 'rating sent'; return; }
  paintStars(rating);
  spark(event);
  document.querySelector('#rating-hint').textContent = 'sending…';
  try {
    const response = await fetch('/api/rating', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating: rating, website: '' }) });
    const body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || 'Could not send rating.');
    localStorage.setItem('otnowSiteRating', String(rating));
    document.querySelector('#rating-hint').textContent = 'thank you';
    setTimeout(load, 500);
  } catch (error) { paintStars(0); document.querySelector('#rating-hint').textContent = error.message; }
}

for (const element of document.querySelectorAll('.stat')) element.addEventListener('pointermove', function (event) {
  const box = element.getBoundingClientRect();
  element.style.setProperty('--mx', event.clientX - box.left + 'px');
  element.style.setProperty('--my', event.clientY - box.top + 'px');
});
for (const button of document.querySelectorAll('#quick-rating .star')) button.addEventListener('click', function (event) { quickRate(Number(button.dataset.rating), event); });
const savedRating = Number(localStorage.getItem('otnowSiteRating')) || 0;
if (savedRating) { paintStars(savedRating); document.querySelector('#rating-hint').textContent = 'rating sent'; }
addEventListener('resize', resize);
addEventListener('pointermove', function (event) { pointer.x = event.clientX; pointer.y = event.clientY; document.documentElement.style.setProperty('--x', event.clientX + 'px'); document.documentElement.style.setProperty('--y', event.clientY + 'px'); });
resize(); draw(0); load(); setInterval(load, 300000);
`;
