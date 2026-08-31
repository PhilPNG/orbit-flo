import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceGate } from "./workspace-gate";
import { useWorkspaceId } from "./workspace-context";

const gateMocks = vi.hoisted(() => ({ listWorkspaces: vi.fn() }));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

vi.mock("./workspaces.queries", () => ({
  listWorkspaces: gateMocks.listWorkspaces,
  workspacesQueryKey: ["workspaces"],
}));

function Consumer() {
  return <p>inside {useWorkspaceId()}</p>;
}

function renderGate(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={
              <WorkspaceGate>
                <Consumer />
              </WorkspaceGate>
            }
            path="/w/:workspaceId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkspaceGate", () => {
  it("provides the workspace when the caller is a member", async () => {
    gateMocks.listWorkspaces.mockResolvedValue([{ id: "ws-1", name: "Personal" }]);

    renderGate("/w/ws-1");

    expect(await screen.findByText("inside ws-1")).toBeTruthy();
  });

  it("refuses a workspace the caller does not belong to", async () => {
    gateMocks.listWorkspaces.mockResolvedValue([{ id: "ws-1", name: "Personal" }]);

    renderGate("/w/ws-someone-else");

    expect(await screen.findByText("This workspace is not yours to open.")).toBeTruthy();
    expect(screen.queryByText(/^inside/)).toBeNull();
  });

  it("surfaces a failure to load the workspace list", async () => {
    gateMocks.listWorkspaces.mockRejectedValue(new Error("network down"));

    renderGate("/w/ws-1");

    expect(await screen.findByText("network down")).toBeTruthy();
  });
});
