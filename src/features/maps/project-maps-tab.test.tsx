import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProjectMapsTab } from "./project-maps-tab";

vi.mock("./map-library-page", () => ({
  MapLibraryPage: ({ onOpenMap, projectId }: { onOpenMap: (id: string) => void; projectId: string | null }) => (
    <button onClick={() => onOpenMap("map-9")} type="button">
      Library for {projectId}
    </button>
  ),
}));
vi.mock("./map-editor-page", () => ({
  MapEditorPage: ({ mapId, onBack, projectId }: { mapId: string; onBack: () => void; projectId: string | null }) => (
    <button onClick={onBack} type="button">
      Editor {mapId} in {projectId}
    </button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.search}</p>;
}

function renderTab(initialEntry: string) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          element={
            <>
              <ProjectMapsTab projectId="project-1" />
              <LocationProbe />
            </>
          }
          path="/projects/:projectId"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectMapsTab", () => {
  it("shows the library and writes ?map= when a map opens", async () => {
    const user = userEvent.setup();
    renderTab("/projects/project-1?task=t-1");

    await user.click(screen.getByRole("button", { name: "Library for project-1" }));

    expect(screen.getByRole("button", { name: "Editor map-9 in project-1" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("?task=t-1&map=map-9");
  });

  it("shows the editor for ?map= and clears it on back", async () => {
    const user = userEvent.setup();
    renderTab("/projects/project-1?map=map-3");

    await user.click(screen.getByRole("button", { name: "Editor map-3 in project-1" }));

    expect(screen.getByRole("button", { name: "Library for project-1" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("");
  });
});
