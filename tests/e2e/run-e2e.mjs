import { spawn } from "node:child_process";
import { once } from "node:events";
import { loadEnv } from "vite";

const port = process.env.E2E_PORT || "5173";
const baseUrl = `http://127.0.0.1:${port}`;
const startupTimeoutMs = 30_000;
const requestTimeoutMs = 2_000;
const debug = process.env.E2E_RUNNER_DEBUG === "1";

/**
 * Most specs run against a placeholder backend — they only need the app to
 * boot. collaboration.spec.ts is the exception: RLS is what it tests, and a
 * placeholder would answer with whatever we asked for and prove nothing. The
 * service role key is what distinguishes the two modes.
 *
 * The placeholders cannot simply be defaults here. Vite's loadEnv applies
 * process.env over the .env files, so injecting a placeholder would *override*
 * the real credentials in .env.local rather than stand in for their absence.
 */
// Both prefixes, so the service role key can live in .env.local next to the
// credentials it belongs with rather than having to be exported by hand.
//
// The E2E_ prefix is load-bearing: Vite only exposes VITE_* to the client, so a
// key named this way is passed to the dev server process but can never reach
// the browser bundle. Do not rename it to VITE_*.
const fileEnv = loadEnv("development", process.cwd(), ["VITE_", "E2E_"]);

const serviceRoleKey =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || fileEnv.E2E_SUPABASE_SERVICE_ROLE_KEY;
const realBackend = Boolean(serviceRoleKey);

const supabaseUrl = realBackend
  ? process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL
  : process.env.VITE_SUPABASE_URL || "https://e2e-placeholder.supabase.co";

const supabaseKey = realBackend
  ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY
  : process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e2e_placeholder";

if (realBackend && (!supabaseUrl || !supabaseKey)) {
  throw new Error(
    "E2E_SUPABASE_SERVICE_ROLE_KEY is set but VITE_SUPABASE_URL / " +
      "VITE_SUPABASE_PUBLISHABLE_KEY are missing. Add them to .env.local.",
  );
}

const e2eEnv = {
  ...process.env,
  VITE_CAPTURE_MODE: process.env.VITE_CAPTURE_MODE || "0",
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey,
  ...(serviceRoleKey ? { E2E_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } : {}),
};

if (realBackend) {
  console.error(
    `[e2e-runner] real backend mode: ${supabaseUrl} — collaboration specs will create and delete throwaway accounts`,
  );
}
let viteProcess;
let playwrightProcess;
let viteCleanupPromise;
let playwrightCleanupPromise;

function log(message) {
  if (debug) console.error(`[e2e-runner] ${message}`);
}

function spawnNode(args, options = {}) {
  return spawn(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
    env: e2eEnv,
    ...options,
  });
}

async function fetchBaseUrl() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(baseUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function isServerResponding() {
  try {
    const response = await fetchBaseUrl();
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited early with code ${child.exitCode}.`);
    }

    try {
      const response = await fetchBaseUrl();
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${baseUrl}.`);
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  let timeout;
  try {
    await Promise.race([
      once(child, "exit"),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function stopChildProcess(child, label) {
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    log(`stopping ${label} with taskkill for pid ${child.pid}`);
    const taskkill = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await once(taskkill, "exit");
    log(`${label} taskkill exited`);
    await waitForExit(child, 5_000);
    child.unref();
    return;
  }

  log(`stopping ${label} with SIGTERM for pid ${child.pid}`);
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);
  try {
    await once(child, "exit");
  } finally {
    clearTimeout(timeout);
  }
}

async function cleanupServer() {
  viteCleanupPromise ??= stopChildProcess(viteProcess, "Vite");
  await viteCleanupPromise;
}

async function cleanupPlaywright() {
  playwrightCleanupPromise ??= stopChildProcess(playwrightProcess, "Playwright");
  await playwrightCleanupPromise;
}

async function cleanupChildren() {
  await cleanupPlaywright();
  await cleanupServer();
}

function handleSignal(signal) {
  const exitCode = signal === "SIGINT" ? 130 : 143;
  log(`received ${signal}; cleaning up child processes before exit`);
  cleanupChildren()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => {
      process.exit(process.exitCode || exitCode);
    });
}

process.once("SIGINT", handleSignal);
process.once("SIGTERM", handleSignal);

async function run() {
  if (await isServerResponding()) {
    throw new Error(
      `Port ${port} is already serving another app; stop it before running e2e.`,
    );
  }

  viteProcess = spawnNode([
    "./node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ]);

  try {
    await waitForServer(viteProcess);
    log("Vite is available");

    playwrightProcess = spawnNode([
      "./node_modules/playwright/cli.js",
      "test",
      ...process.argv.slice(2),
    ], {
      env: {
        ...e2eEnv,
        PLAYWRIGHT_SKIP_WEBSERVER: "1",
      },
    });
    const [code, signal] = await once(playwrightProcess, "exit");
    log(`Playwright exited with code ${code ?? "null"} and signal ${signal ?? "null"}`);

    if (signal) {
      process.exitCode = 1;
      return;
    }

    process.exitCode = code ?? 1;
  } finally {
    await cleanupServer();
    log("Vite cleanup finished");
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
