const FEEDBACK_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfvZY5paIPzJv8adIeHdkpgwzXldEqnMhM4Zbp2_c8kg7dqXw/viewform";
const STORE_URL = "https://chromewebstore.google.com/detail/otnow/ekaachncjiajgiikgikhpafcnepompkn";
const REPOSITORY_URL = "https://github.com/sil6428/OTNow";
const SECURITY_URL = `${REPOSITORY_URL}/security/advisories/new`;

export const SUPPORT_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="OTNow feedback, help, and reinstall links.">
  <meta name="theme-color" content="#05070a">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <title>OTNow - Feedback and Support</title>
  <style>
    :root{color-scheme:dark;--bg:#05070a;--surface:#0b0e13;--text:#f7f8fa;--muted:#9298a2;--line:rgba(255,255,255,.11);--blue:#58baff;--orange:#ff7148;--green:#63daa1}*{box-sizing:border-box}body{min-height:100vh;margin:0;background:radial-gradient(780px circle at 80% 0,rgba(88,186,255,.12),transparent 62%),radial-gradient(620px circle at 5% 75%,rgba(255,113,72,.07),transparent 65%),var(--bg);color:var(--text);font:15px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit}.shell{width:min(980px,calc(100% - 42px));margin:auto}.top{border-bottom:1px solid rgba(255,255,255,.08);background:rgba(5,7,10,.82);backdrop-filter:blur(20px)}.nav{display:flex;min-height:66px;align-items:center;justify-content:space-between;gap:20px}.brand{display:inline-flex;align-items:center;gap:10px;font-size:13px;font-weight:750;text-decoration:none}.mark{position:relative;width:20px;height:20px;border:1.5px solid var(--blue);border-radius:6px;transform:rotate(45deg)}.mark:after{position:absolute;inset:6px;content:"";border-radius:2px;background:var(--orange)}.nav a:last-child{color:var(--muted);font-size:11px;text-decoration:none}.hero{padding:86px 0 46px}.eyebrow{margin:0 0 12px;color:#a5d8f8;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}.eyebrow:before{display:inline-block;width:24px;height:1px;margin:0 9px 3px 0;content:"";background:var(--blue)}h1{max-width:760px;margin:0;font-size:clamp(42px,7vw,72px);font-weight:630;line-height:.98;letter-spacing:-.06em}.lead{max-width:680px;margin:22px 0 0;color:var(--muted);font-size:17px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 0 80px}.card{padding:26px;border:1px solid var(--line);border-radius:18px;background:rgba(11,14,19,.82)}.card.wide{grid-column:1/-1}.number{display:block;margin-bottom:16px;color:var(--blue);font-size:10px;font-weight:800;letter-spacing:.12em}h2{margin:0 0 9px;font-size:20px;letter-spacing:-.03em}.card p{margin:0;color:#afb5bd}.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.button{padding:9px 12px;border:1px solid var(--line);border-radius:999px;color:#d5dae0;font-size:11px;font-weight:750;text-decoration:none}.button.primary{border-color:var(--blue);background:var(--blue);color:#06111f}.button.security{border-color:rgba(99,218,161,.25);color:#bff4d8}.button:hover,.button:focus-visible{border-color:#fff;color:#fff}.button.primary:hover,.button.primary:focus-visible{color:#06111f}.note{margin-top:16px!important;color:#727983!important;font-size:11px}.footer{display:flex;justify-content:space-between;gap:20px;padding:24px 0 32px;border-top:1px solid var(--line);color:#656c76;font-size:10px}.footer a{text-decoration:none}@media(max-width:680px){.shell{width:min(100% - 28px,980px)}.nav{min-height:58px}.hero{padding:60px 0 34px}.lead{font-size:15px}.grid{grid-template-columns:1fr;padding-bottom:56px}.card.wide{grid-column:auto}.footer{align-items:flex-start;flex-direction:column}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <nav class="top"><div class="shell nav"><a class="brand" href="/dashboard"><span class="mark" aria-hidden="true"></span><span>OTNow · Support</span></a><a href="/privacy">Privacy policy</a></div></nav>
  <main class="shell">
    <header class="hero"><p class="eyebrow">Feedback and support</p><h1>Leaving, troubleshooting, or sharing an idea?</h1><p class="lead">Everything here is optional. Uninstalling OTNow removes its local extension data through Chrome; it does not change or delete anything in Canvas.</p></header>
    <section class="grid">
      <article class="card"><span class="number">01</span><h2>Send feedback</h2><p>Report a bug, describe a confusing interaction, or suggest an improvement through the private OTNow feedback form.</p><div class="actions"><a class="button primary" href="${FEEDBACK_URL}">Open feedback form ↗</a></div><p class="note">Remove student numbers, grades, private course content, and screenshots containing personal information before submitting.</p></article>
      <article class="card"><span class="number">02</span><h2>Reinstall or get help</h2><p>The Chrome Web Store provides automatic updates. The GitHub repository contains setup information, known limitations, and release notes.</p><div class="actions"><a class="button" href="${STORE_URL}">Chrome Web Store ↗</a><a class="button" href="${REPOSITORY_URL}">GitHub help ↗</a></div></article>
      <article class="card wide"><span class="number">03</span><h2>Security concerns use a private route</h2><p>Do not place suspected vulnerabilities, session details, or security-sensitive screenshots in the feedback form, server chats, or public GitHub issues.</p><div class="actions"><a class="button security" href="${SECURITY_URL}">Report a vulnerability privately ↗</a></div></article>
    </section>
  </main>
  <footer class="shell footer"><span>OTNow is an independent student project.</span><span><a href="/dashboard">Statistics</a> · <a href="/privacy">Privacy</a></span></footer>
</body>
</html>`;
