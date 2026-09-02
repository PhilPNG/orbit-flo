/// <reference types="webmcp-types" />
/**
 * Registers one read-only WebMCP tool on the signed-out storefront.
 *
 * Mirrors useAgentTools' feature-detect + AbortController shape exactly, but
 * stays deliberately thinner: no Supabase import anywhere in this file. The
 * landing page renders for anonymous visitors, so it must not pull the
 * Supabase client into the storefront bundle chunk, and it has no session or
 * workspace to hand a tool anyway - `about_orbit_flo` answers from static
 * text alone.
 */
import { useEffect } from "react";

const REPO_URL = "https://github.com/PhilPNG/orbit-flo";

const ABOUT_TEXT = [
  "Orbit Flo is mission control for software projects - boards, daily flight",
  "plans, milestones and linked notes inside a live galaxy. It also speaks",
  "WebMCP: sign in and thirteen workspace tools appear, letting an agent-hosting",
  "browser plan the day, file tasks, triage the inbox, and move work across",
  "the board in your own session.",
  "",
  `Source: ${REPO_URL}`,
].join(" \n").replace(/ \n/g, "\n");

export function useLandingAgentTool(): void {
  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) return;

    const controller = new AbortController();

    void modelContext.registerTool(
      {
        name: "about_orbit_flo",
        description: "Learn what Orbit Flo is, what it does, and where its source lives.",
        inputSchema: { type: "object", properties: {}, required: [] },
        annotations: { readOnlyHint: true },
        execute: async () => ({ content: [{ type: "text", text: ABOUT_TEXT }] }),
      },
      { signal: controller.signal },
    );

    return () => controller.abort();
  }, []);
}
