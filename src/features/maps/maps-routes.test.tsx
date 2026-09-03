import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapsEditorRoute, MapsLibraryRoute } from "./maps-routes";

const editorMocks = vi.hoisted(() => ({ mountCount: 0 }));

vi.mock("../workspaces/workspace-context", () => ({ useWorkspaceId: () => "ws-1" }));
vi.mock("./map-editor-page", async () => {
  const React = await import("react");
  return {
    MapEditorPage: function MockEditor({ mapId }: { mapId: string }) {
      React.useEffect(() => {
        editorMocks.mountCount += 1;
      }, []);
      return <p>Editor {mapId}</p>;
    },
  };
});
vi.mock("./map-library-page", () => ({
  MapLibraryPage: ({ onOpenMap }: { onOpenMap: (mapId: string) => void }) => (
    <button onClick={() => onOpenMap("map-2")} type="button">
      Open map 2
    </button>
  ),
}));

function renderRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Link to="/w/ws-1/maps/map-2">Go to map 2</Link>
      <Routes>
        <Route element={<MapsLibraryRoute />} path="/w/:workspaceId/maps" />
        <Route element={<MapsEditorRoute />} path="/w/:workspaceId/maps/:mapId" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("maps routes", () => {
  beforeEach(() => {
    editorMocks.mountCount = 0;
  });

  it("remounts the editor when the map id in the URL changes", async () => {
    const user = userEvent.setup();
    renderRoutes("/w/ws-1/maps/map-1");

    expect(screen.getByText("Editor map-1")).toBeTruthy();
    expect(editorMocks.mountCount).toBe(1);

    await user.click(screen.getByRole("link", { name: "Go to map 2" }));

    expect(screen.getByText("Editor map-2")).toBeTruthy();
    expect(editorMocks.mountCount).toBe(2);
  });

  it("opens a map from the library", async () => {
    const user = userEvent.setup();
    renderRoutes("/w/ws-1/maps");

    await user.click(screen.getByRole("button", { name: "Open map 2" }));

    expect(screen.getByText("Editor map-2")).toBeTruthy();
  });
});
