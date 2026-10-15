const FEEDBACK_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfvZY5paIPzJv8adIeHdkpgwzXldEqnMhM4Zbp2_c8kg7dqXw/viewform";
const STORE_URL = "https://chromewebstore.google.com/detail/otnow/ekaachncjiajgiikgikhpafcnepompkn";
const REPOSITORY_URL = "https://github.com/sil6428/OTNow";
const KO_FI_URL = "https://ko-fi.com/sil6428";
const SECURITY_URL = `${REPOSITORY_URL}/security/advisories/new`;

const PAGE_STYLE = String.raw`
  :root{color-scheme:light;--bg:#eaf4ff;--surface:#fff;--text:#102b46;--muted:#5f7285;--line:rgba(17,60,97,.14);--blue:#0878c9;--orange:#f25c2a;--green:#1d9b70}
  *{box-sizing:border-box}body{min-height:100vh;margin:0;background:linear-gradient(145deg,#f7fbff,var(--bg) 62%,#fff0e9);color:var(--text);font:15px/1.6 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit}.wash{position:fixed;inset:0;pointer-events:none;background:radial-gradient(520px circle at var(--x,58%) var(--y,35%),rgba(50,169,255,.11),transparent 70%);transition:background .1s linear}.bar,.page{position:relative;z-index:1}.bar{border-bottom:1px solid var(--line);background:rgba(234,244,255,.86);backdrop-filter:blur(18px)}.nav{display:flex;width:min(680px,calc(100% - 36px));min-height:58px;margin:auto;align-items:center;justify-content:space-between}.brand{display:inline-flex;align-items:center;gap:9px;color:#082d52;font-size:13px;font-weight:800;text-decoration:none}.mark{position:relative;width:18px;height:18px;border:2px solid #082d52;border-radius:2px;background:#fff;transform:rotate(45deg)}.mark:after{position:absolute;inset:4px;content:"";border-radius:1px;background:var(--orange)}.nav>a:last-child{color:var(--muted);font-size:11px;text-decoration:none}.page{display:grid;width:min(680px,calc(100% - 32px));min-height:calc(100vh - 59px);margin:auto;padding:40px 0;place-items:center}.panel{width:100%;padding:34px;border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.88);box-shadow:0 22px 70px rgba(27,72,112,.12)}.eyebrow{margin:0 0 8px;color:var(--blue);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0;color:#082d52;font-size:clamp(30px,5vw,40px);font-weight:700;line-height:1.08;letter-spacing:-.04em}.lead{max-width:590px;margin:14px 0 24px;color:var(--muted);font-size:15px}.notice{margin:0;padding:15px 0;border-block:1px solid var(--line);color:#405a70;font-size:12px}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.button{padding:9px 13px;border:1px solid var(--line);border-radius:999px;background:#fff;color:#294963;font-size:12px;font-weight:750;text-decoration:none}.button.primary{border-color:var(--orange);background:var(--orange);color:#fff}.button:hover,.button:focus-visible{border-color:var(--blue);color:#082d52}.button.primary:hover,.button.primary:focus-visible{color:#fff;filter:brightness(1.04)}.help{margin:18px 0 0;color:#72879a;font-size:11px}.help a{color:#405a70}.help a:hover,.help a:focus-visible{color:#082d52}@media(max-width:560px){.page{align-items:start;padding-top:24px}.panel{padding:24px 20px}.actions{flex-direction:column}.button{text-align:center}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.wash{transition:none}}
`;

function page({ title, eyebrow, heading, lead, notice, actions, help }) {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#eaf4ff">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>${title}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="wash" aria-hidden="true"></div>
  <header class="bar"><nav class="nav"><a class="brand" href="/"><span class="mark" aria-hidden="true"></span>OTNow</a><a href="/privacy">Privacy policy</a></nav></header>
  <main class="page"><section class="panel"><p class="eyebrow">${eyebrow}</p><h1>${heading}</h1><p class="lead">${lead}</p><p class="notice">${notice}</p><div class="actions">${actions}</div><p class="help">${help}</p></section></main>
  <script src="/support.js"></script>
</body>
</html>`;
}

export const SUPPORT_PAGE = page({
  title: "OTNow - Support",
  eyebrow: "Support",
  heading: "How can we help?",
  lead: "Report a problem, suggest an improvement, or find the official installation and project pages.",
  notice: "Before sending feedback, remove student numbers, grades, private course content, and screenshots containing personal information.",
  actions: `<a class="button primary" href="${FEEDBACK_URL}">Open feedback form ↗</a><a class="button" href="${REPOSITORY_URL}">GitHub help ↗</a><a class="button" href="${STORE_URL}">Chrome Web Store ↗</a><a class="button" href="${KO_FI_URL}">Support OTNow on Ko-fi ↗</a>`,
  help: `Found a possible security issue? <a href="${SECURITY_URL}">Report it privately through GitHub ↗</a>`,
});

export const UNINSTALL_PAGE = page({
  title: "OTNow - Thanks for trying it",
  eyebrow: "Thank you",
  heading: "Thanks for trying OTNow.",
  lead: "If something did not work or the extension was not useful for you, a short note would help make the next version better.",
  notice: "Uninstalling OTNow removes its local extension data through Chrome. It does not change or delete anything in Canvas.",
  actions: `<a class="button primary" href="${FEEDBACK_URL}">Share feedback ↗</a><a class="button" href="${STORE_URL}">Reinstall OTNow ↗</a>`,
  help: `Need help instead? <a href="${REPOSITORY_URL}">Open the GitHub project ↗</a> · Security concerns use the <a href="${SECURITY_URL}">private reporting form ↗</a>`,
});

export const SUPPORT_SCRIPT = String.raw`
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion) addEventListener('pointermove', function (event) {
  document.documentElement.style.setProperty('--x', event.clientX + 'px');
  document.documentElement.style.setProperty('--y', event.clientY + 'px');
});
`;
