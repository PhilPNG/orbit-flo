import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { orbitAssets } from "./orbit-assets";

describe("orbitAssets", () => {
  it.each([
    orbitAssets.illustrations.authOrbitCore,
    orbitAssets.illustrations.emptyInbox,
    orbitAssets.illustrations.emptyMap,
    orbitAssets.illustrations.emptyBrainstorm,
    orbitAssets.illustrations.emptyToday,
    orbitAssets.textures.deepSpaceGrain,
  ])("maps %s to a public PNG", (assetPath) => {
    expect(assetPath).toMatch(/\.png$/);
    expect(existsSync(resolve("public", assetPath.replace(/^\//, "")))).toBe(true);
  });
});
