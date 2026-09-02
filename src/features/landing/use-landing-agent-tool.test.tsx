import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useLandingAgentTool } from "./use-landing-agent-tool";

function Probe() {
  useLandingAgentTool();
  return null;
}

function mount() {
  return render(<Probe />);
}

type Registered = { name: string; signal: AbortSignal | undefined };

function installFakeModelContext() {
  const registered: Registered[] = [];
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: (tool: { name: string }, options?: { signal?: AbortSignal }) => {
        registered.push({ name: tool.name, signal: options?.signal });
        return Promise.resolve();
      },
    },
  });
  return registered;
}

afterEach(() => {
  delete (document as { modelContext?: unknown }).modelContext;
});

describe("useLandingAgentTool", () => {
  it("registers nothing and throws nothing when the API is absent", () => {
    // The primary path: every current browser without the WebMCP flag, and
    // jsdom in every other test file.
    expect(() => {
      const view = mount();
      view.unmount();
    }).not.toThrow();
  });

  it("registers exactly about_orbit_flo when the API exists", () => {
    const registered = installFakeModelContext();

    mount();

    expect(registered.map((r) => r.name)).toEqual(["about_orbit_flo"]);
  });

  it("aborts its registration on unmount", () => {
    const registered = installFakeModelContext();

    const view = mount();
    expect(registered[0].signal?.aborted).toBe(false);

    view.unmount();
    expect(registered[0].signal?.aborted).toBe(true);
  });
});
