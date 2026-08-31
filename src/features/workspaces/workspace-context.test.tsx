import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceId } from "./workspace-context";
import { getStoredWorkspaceId } from "../../lib/supabase/workspace";

function Consumer() {
  return <p>workspace: {useWorkspaceId()}</p>;
}

describe("WorkspaceProvider", () => {
  it("exposes the workspace id to consumers", () => {
    render(
      <WorkspaceProvider workspaceId="ws-1">
        <Consumer />
      </WorkspaceProvider>,
    );

    expect(screen.getByText("workspace: ws-1")).toBeTruthy();
  });

  it("re-renders consumers when the workspace changes", () => {
    const { rerender } = render(
      <WorkspaceProvider workspaceId="ws-1">
        <Consumer />
      </WorkspaceProvider>,
    );

    rerender(
      <WorkspaceProvider workspaceId="ws-2">
        <Consumer />
      </WorkspaceProvider>,
    );

    expect(screen.getByText("workspace: ws-2")).toBeTruthy();
  });

  it("records the workspace as the last-used hint", () => {
    window.localStorage.clear();

    render(
      <WorkspaceProvider workspaceId="ws-7">
        <Consumer />
      </WorkspaceProvider>,
    );

    expect(getStoredWorkspaceId()).toBe("ws-7");
  });

  it("throws when the hook is used outside the provider", () => {
    // React logs the thrown render error; silence it for this assertion only.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(
      "useWorkspaceId must be used inside a WorkspaceProvider.",
    );

    consoleError.mockRestore();
  });
});
