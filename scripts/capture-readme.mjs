/**
 * Captures the README screenshots against a running dev server, signed in as
 * the seeded demo account - so the shots show a lived-in workspace, not lorem
 * ipsum, and they are reproducible after every reseed.
 *
 * Prereqs: `node scripts/seed-demo.mjs` has run, and the dev server is up on
 * 127.0.0.1:5173 with real Supabase env in .env.local.
 *
 * Run: node scripts/capture-readme.mjs
 * Output: docs/media/*.png at 1440x900 @2x.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5173";
/** --landing: 1x captures into public/assets/landing/ for the marketing page,
 *  instead of the 2x README shots. Same flow, same waits, lighter files. */
const LANDING = process.argv.includes("--landing");
const OUT = new URL(LANDING ? "../public/assets/landing/" : "../docs/media/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const DEMO_EMAIL = "orbit-flo-demo@example.com";
const DEMO_PASSWORD = "orbit-demo-2026";

/** Entry animations: settle 420ms, stagger up to 480ms, count-up 700ms. */
const SETTLE_MS = 1800;

async function shoot(page, name) {
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(`captured ${name}.png`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // Headed, not headless: headless Chromium software-renders the WebGL
  // galaxy through SwiftShader on the CPU, which starves the whole page -
  // auth resolution was observed taking ~50s and loads were flaky. A headed
  // window uses the real GPU and behaves like the app actually behaves.
  const browser = await chromium.launch({
    headless: false,
    // Keeps Windows scrollbars out of the shots - they scream "screenshot".
    args: ["--hide-scrollbars"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: LANDING ? 1 : 2,
  });

  // 1. The front door: orb, satellites, sign-in form.
  await page.goto(`${BASE}/auth`, { waitUntil: "load" });
  await shoot(page, "auth");

  // Sign in as the demo account (same selectors the e2e suite uses).
  await page.getByPlaceholder("Email").fill(DEMO_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(DEMO_PASSWORD);
  // noWaitAfter: the submit is prevented and auth happens async, so the
  // "scheduled navigation" Playwright would wait for never occurs.
  await page.getByRole("button", { name: "Enter orbit" }).click({ noWaitAfter: true });
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 45_000 });
  } catch (error) {
    await page.screenshot({ path: `${OUT}debug-stuck.png` });
    throw new Error(`never left auth; now at ${page.url()} - see debug-stuck.png`);
  }

  // Wait for the shell itself before navigating anywhere. Headless auth
  // resolution has been observed taking ~50s on this machine, hence the
  // generous timeout and the debug shot on failure.
  try {
    await page.getByText("Orbit Flo HQ").first().waitFor({ timeout: 90_000 });
  } catch {
    await page.screenshot({ path: `${OUT}debug-shell.png` });
    throw new Error(`shell never loaded; at ${page.url()} - see debug-shell.png`);
  }

  // Client-side navigation from here on: a fresh goto re-resolves the auth
  // session each time ("Preparing your orbit"), which is what a fixed settle
  // kept photographing. Each shot waits for SEEDED content, so the capture
  // breaks loudly if the seed and the script drift apart.

  // 2. Mission control dashboard.
  await page.getByRole("link", { name: "Dashboard" }).click();
  // The dashboard shows the seeded decision note and priority work, not
  // project names - wait on content that page actually renders.
  try {
    await page.getByText("Priority work").first().waitFor({ timeout: 30_000 });
  } catch {
    await page.screenshot({ path: `${OUT}debug-dashboard.png` });
    throw new Error("dashboard content mismatch - see debug-dashboard.png");
  }
  await shoot(page, "dashboard");

  // 3. Today's flight plan.
  await page.getByRole("link", { name: "Today" }).click();
  await page.getByText("Write the launch announcement").first().waitFor({ timeout: 30_000 });
  await shoot(page, "flight-plan");

  // 4. The kanban board inside a project.
  await page.getByRole("link", { name: "Missions" }).click();
  // force: the staggered card entrance keeps the element from ever reading
  // "stable" to the actionability checks; the link is real and clickable.
  await page.getByRole("link", { name: /Open Launch the Website/ }).click({ force: true, noWaitAfter: true, timeout: 30_000 });
  await page.getByText("Record the demo video").first().waitFor({ timeout: 30_000 });
  // The board columns sit below the planning panels - scroll the cards into
  // frame so the shot shows the seeded board, not the onboarding furniture.
  await page.getByText("Record the demo video").first().scrollIntoViewIfNeeded();
  // A little further, so the columns headline the frame instead of the
  // recurring-tasks panel above them.
  await page.mouse.wheel(0, 300);
  await shoot(page, "board");

  // 5. The inbox with captures waiting for triage.
  await page.getByRole("link", { name: "Inbox" }).click();
  await page.getByText("App Store review").first().waitFor({ timeout: 30_000 });
  await shoot(page, "inbox");

  await browser.close();
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
