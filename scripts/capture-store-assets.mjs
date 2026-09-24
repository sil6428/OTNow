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
  await page.goto("http://127.0.0.1:8766/docs/demo-host.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(media, "otnow-store-1280x800.png") });
} finally {
  await browser.close();
}

console.log("Captured docs/media/otnow-store-1280x800.png");
