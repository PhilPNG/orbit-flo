import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

const captures = [
  ["01-inbox", "01-inbox.png"],
  ["02-maps-library", "02-maps-library.png"],
  ["03-maps-mind-map", "03-maps-mind-map.png"],
  ["04-missions", "04-missions.png"],
  ["05-auth", "05-auth.png"],
  ["06-brainstorm", "06-brainstorm.png"],
  ["07-settings", "07-settings.png"],
  ["08-mission-workspace-board", "08-mission-workspace-board.png"],
  ["09-today", "09-today.png"],
  ["10-task-card-modal", "10-task-card-modal.png"],
] as const;

const productScreenIds = new Set([
  "01-inbox",
  "02-maps-library",
  "03-maps-mind-map",
  "04-missions",
  "06-brainstorm",
  "07-settings",
  "08-mission-workspace-board",
  "09-today",
]);

test.describe("redesign captures", () => {
  test.skip(process.env.VITE_CAPTURE_MODE !== "1", "requires capture mode");

  for (const [screenId, fileName] of captures) {
    test(`captures ${screenId} at 1440x900`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await page.clock.setFixedTime(new Date("2026-07-12T12:00:00-04:00"));
      await page.goto(`/__visual/${screenId}`);
      await expect(page.getByTestId(`visual-${screenId}`)).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, (image) => image.decode()));
      });

      if (productScreenIds.has(screenId)) {
        await expect(page.getByRole("img", { name: "Orbit Flo" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
        const rail = page.getByTestId("app-shell").locator(":scope > aside");
        const railMetrics = await rail.evaluate((element) => ({
          clientWidth: element.clientWidth,
          height: element.getBoundingClientRect().height,
          scrollWidth: element.scrollWidth,
          width: element.getBoundingClientRect().width,
        }));
        expect(railMetrics.width).toBe(232);
        expect(railMetrics.height).toBe(900);
        expect(railMetrics.scrollWidth).toBeLessThanOrEqual(railMetrics.clientWidth);

        const commandLabel = page.getByText("Command palette", { exact: true });
        expect(
          await commandLabel.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
      }

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        1440,
      );

      const output = resolve("docs/design/orbit-flo-redesign", fileName);
      await page.screenshot({ animations: "disabled", fullPage: false, path: output });
      const png = await readFile(output);
      expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(1440);
      expect(png.readUInt32BE(20)).toBe(900);
    });
  }
});
