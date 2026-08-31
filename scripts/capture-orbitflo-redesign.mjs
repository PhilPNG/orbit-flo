import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

const screenIds = [
  "01-inbox",
  "02-maps-library",
  "03-maps-mind-map",
  "04-missions",
  "05-auth",
  "06-brainstorm",
  "07-settings",
  "08-mission-workspace-board",
  "09-today",
  "10-task-card-modal",
];

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate an e2e capture port."));
        return;
      }

      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function captureScreen(screenId, index) {
  const port = await findOpenPort();
  const titlePattern = `captures ${escapeRegExp(screenId)} at 1440x900$`;
  const child = spawn(
    process.execPath,
    [
      "tests/e2e/run-e2e.mjs",
      "tests/e2e/redesign-captures.spec.ts",
      "--grep",
      titlePattern,
    ],
    {
      env: {
        ...process.env,
        E2E_HEADED: "0",
        E2E_PORT: String(port),
        E2E_BROWSER_CHANNEL: "chromium",
        VITE_CAPTURE_MODE: "1",
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const [code, signal] = await once(child, "exit");

  if (signal || code !== 0) {
    throw new Error(
      `Capture ${screenId} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`,
    );
  }

  console.log(`[capture:redesign] ${index + 1}/${screenIds.length} ${screenId} passed`);
}

try {
  for (const [index, screenId] of screenIds.entries()) {
    await captureScreen(screenId, index);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
