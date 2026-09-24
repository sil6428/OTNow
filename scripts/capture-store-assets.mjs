import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error("Set CODEX_NODE_MODULES to the bundled Node modules directory.");
const { chromium } = require(resolve(modules, "playwright"));

const root = resolve(import.meta.dirname, "..");
const media = resolve(root, "docs", "media");
await mkdir(media, { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => console.error(`Preview error: ${error.message}`));
  await page.goto("http://127.0.0.1:8766/docs/demo-host.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(media, "otnow-store-1280x800.png") });
  await page.frameLocator("iframe").locator(".view-tab").filter({ hasText: "Courses" }).click();
  await page.screenshot({ path: resolve(media, "otnow-courses-1280x800.png") });
  await page.frameLocator("iframe").locator(".view-tab").filter({ hasText: "Deadlines" }).click();
  await page.frameLocator("iframe").locator("#theme-toggle").click();
  await page.screenshot({ path: resolve(media, "otnow-dark-1280x800.png") });

  const narrowPage = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1 });
  await narrowPage.goto("http://127.0.0.1:8766/docs/demo-panel.html", { waitUntil: "networkidle" });
  await narrowPage.screenshot({ path: resolve(media, "otnow-narrow-360x800.png") });
  await narrowPage.goto("http://127.0.0.1:8766/docs/demo-panel.html?update=1", { waitUntil: "networkidle" });
  await narrowPage.screenshot({ path: resolve(media, "otnow-update-360x800.png") });
  await narrowPage.close();

  const promoPage = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  await promoPage.goto("http://127.0.0.1:8766/docs/demo-promo.html", { waitUntil: "networkidle" });
  await promoPage.screenshot({ path: resolve(media, "otnow-promo-440x280.png") });
  await promoPage.close();
} finally {
  await browser.close();
}

console.log("Captured deadline, course, dark-mode, narrow-panel, update-notice, and promotional images");
