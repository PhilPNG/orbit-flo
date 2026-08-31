import { expect, test } from "playwright/test";

test("unauthenticated user sees auth screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Enter your flow state." })).toBeVisible();
  await expect(page.getByRole("img", { name: "Orbit Flo" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();

  const logoImage = page.locator('img[src="/assets/brand/orbit-flo-lockup-dark.png"]').first();
  await expect(logoImage).toBeVisible();
  await expect(logoImage).toHaveJSProperty("naturalWidth", 960);
  await expect(logoImage).toHaveJSProperty("naturalHeight", 360);

  await expect(page.getByTestId("auth-orbit-scene")).toBeVisible();
  await expect(page.getByAltText("Orbit Flo onboarding command module")).toHaveCount(0);

  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Create your command seat." })).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toBeVisible();
  await expect(page.getByText("Launch sequence")).toBeVisible();
});
