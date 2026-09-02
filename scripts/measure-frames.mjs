/**
 * Median frame times on the pages that matter, via headed Chromium (headless
 * software-renders WebGL and rAF is suspended in the hidden pane - this is
 * the only honest way to measure on this machine).
 * Run: node scripts/measure-frames.mjs  (dev server on 5173, demo seeded)
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5173";
const SAMPLE = `new Promise((resolve) => {
  const times = [];
  let last = performance.now();
  const tick = (now) => {
    times.push(now - last);
    last = now;
    if (times.length < 240) requestAnimationFrame(tick);
    else {
      times.sort((a, b) => a - b);
      resolve({
        median: +times[120].toFixed(2),
        p95: +times[Math.floor(times.length * 0.95)].toFixed(2),
        canvases: document.querySelectorAll("canvas").length,
      });
    }
  };
  requestAnimationFrame(tick);
})`;

const browser = await chromium.launch({ headless: false, args: [
    "--hide-scrollbars",
    // Chrome throttles rAF in occluded windows, which fakes ~100ms frames on
    // any page. These keep the measurement window rendering at full rate.
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

async function measure(label) {
  await page.waitForTimeout(2500); // let entrances settle so we measure steady state
  const result = await page.evaluate(SAMPLE);
  console.log(`${label}: median ${result.median}ms  p95 ${result.p95}ms  canvases ${result.canvases}`);
}

await page.goto("about:blank");
await measure("baseline (about:blank)");

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 30_000 });
await measure("landing (galaxy + orb)");

await page.goto(`${BASE}/auth`, { waitUntil: "load" });
await measure("auth (galaxy + orb)");

await page.getByPlaceholder("Email").fill("orbit-flo-demo@example.com");
await page.locator('input[autocomplete="current-password"]').fill("orbit-demo-2026");
await page.getByRole("button", { name: "Enter orbit" }).click({ noWaitAfter: true });
await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 45_000 });
await page.getByText("Orbit Flo HQ").first().waitFor({ timeout: 90_000 });

await page.getByRole("link", { name: "Today" }).click();
await page.getByText("Write the launch announcement").first().waitFor({ timeout: 30_000 });
await measure("today (galaxy only)");

await page.getByRole("link", { name: "Missions" }).click();
await page.getByRole("link", { name: /Open Launch the Website/ }).click({ force: true, noWaitAfter: true, timeout: 30_000 });
await page.getByText("Record the demo video").first().waitFor({ timeout: 30_000 });
await measure("project (galaxy + topography)");

await browser.close();
