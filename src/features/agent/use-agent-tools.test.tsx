import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../lib/query-client";
import { WorkspaceContext } from "../workspaces/workspace-context";
import { useAgentTools } from "./use-agent-tools";

vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: "user-1" } } } }),
    },
  },
}));

function Probe() {
  useAgentTools();
  return null;
}

function mount(workspaceId: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceContext.Provider value={workspaceId}>
        <Probe />
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
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
  vi.restoreAllMocks();
});

describe("useAgentTools", () => {
  it("registers nothing and throws nothing when the API is absent", () => {
    // This is the path every current browser without the flag takes, and the
    // path jsdom takes - the primary path, not an edge case.
    expect(() => {
      const view = mount("ws-1");
      view.unmount();
    }).not.toThrow();
  });

  it("registers all ten tools when the API exists", async () => {
    const registered = installFakeModelContext();

    mount("ws-1");

    // Registration happens after the session resolves, so it is async.
    await vi.waitFor(() => expect(registered.length).toBe(10));
    expect(registered.map((r) => r.name).sort()).toEqual([
      "add_to_flight_plan",
      "capture_thought",
      "complete_plan_item",
      "create_task",
      "file_capture_as_task",
      "get_flight_plan",
      "list_inbox",
      "list_projects",
      "move_task",
      "search_workspace",
    ]);
  });

  it("aborts its registrations on unmount, so a signed-out page offers no tools", async () => {
    const registered = installFakeModelContext();

    const view = mount("ws-1");
    await vi.waitFor(() => expect(registered.length).toBe(10));
    expect(registered[0].signal?.aborted).toBe(false);

    view.unmount();
    expect(registered.every((r) => r.signal?.aborted)).toBe(true);
  });

  it("re-registers when the workspace changes, so tools always act on the workspace on screen", async () => {
    const registered = installFakeModelContext();

    const view = mount("ws-1");
    await vi.waitFor(() => expect(registered.length).toBe(10));
    const firstBatch = [...registered];

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <WorkspaceContext.Provider value="ws-2">
          <Probe />
        </WorkspaceContext.Provider>
      </QueryClientProvider>,
    );

    expect(firstBatch.every((r) => r.signal?.aborted)).toBe(true);
    await vi.waitFor(() => expect(registered.length).toBe(20));
  });
});
