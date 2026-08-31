import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase environment", () => {
  it("throws when required Vite env vars are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.resetModules();

    await expect(import("./client")).rejects.toThrow(
      "Missing Supabase environment variables",
    );
  });

  it("type-checks project selects through the generated Database type", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.resetModules();

    const { supabase } = await import("./client");
    const query = supabase.from("projects").select("*");

    expect(query).toBeDefined();
  });
});
