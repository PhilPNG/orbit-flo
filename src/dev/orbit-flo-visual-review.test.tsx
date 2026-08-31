import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OrbitFloVisualReview } from "./orbit-flo-visual-review";

const workspaceStorageKey = "project-command-center:workspace-id";
const navStorageKey = "orbitflo:nav-collapsed";
const layoutStorageKey = "orbitflo:daily-home-layout";
const captureLayoutValue = JSON.stringify({
  quickCapture: true,
  momentum: true,
  suggestions: true,
  review: true,
});
const realLayoutValue = '{"quickCapture":false,"momentum":true,"suggestions":false,"review":true,"extra":"preserve"}';

const unexpectedSupabaseCall = vi.hoisted(() => vi.fn(() => {
  throw new Error("The visual-review harness must not call Supabase.");
}));

vi.mock("../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: unexpectedSupabaseCall,
      onAuthStateChange: unexpectedSupabaseCall,
      signInWithOAuth: unexpectedSupabaseCall,
      signInWithPassword: unexpectedSupabaseCall,
      signOut: unexpectedSupabaseCall,
    },
    from: unexpectedSupabaseCall,
    storage: { from: unexpectedSupabaseCall },
  },
}));

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
});

beforeEach(() => {
  unexpectedSupabaseCall.mockClear();
  [workspaceStorageKey, navStorageKey, layoutStorageKey].forEach((key) => {
    window.localStorage.removeItem(key);
  });
});

afterEach(() => {
  [workspaceStorageKey, navStorageKey, layoutStorageKey].forEach((key) => {
    window.localStorage.removeItem(key);
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("OrbitFloVisualReview", () => {
  it.each([
    "01-inbox",
    "02-maps-library",
    "03-maps-mind-map",
    "04-missions",
    "05-auth",
    "06-brainstorm",
    "07-settings",
    "08-mission-workspace-board",
    "09-today",
    "10-task-card-modal",
  ] as const)("renders deterministic production composition %s", (screenId) => {
    render(
      <MemoryRouter>
        <OrbitFloVisualReview screenId={screenId} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId(`visual-${screenId}`)).toBeVisible();
    expect(unexpectedSupabaseCall).not.toHaveBeenCalled();
  });

  it("holds the approved board in its real undropped drag state", async () => {
    const { container } = render(
      <MemoryRouter>
        <OrbitFloVisualReview screenId="08-mission-workspace-board" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(container.querySelector(".kanban-drag-preview")).toHaveTextContent(
        "Polish the release path",
      );
    });
    expect(container.querySelector(".kanban-drag-preview")).toHaveStyle({
      left: "756px",
      top: "654px",
    });
    expect(screen.getByRole("region", { name: "Ready to Launch column" })).toHaveClass(
      "kanban-drop-target",
    );
    expect(screen.queryByRole("button", { name: "Add column" })).not.toBeInTheDocument();
  });

  it("binds query-owning fixtures to capture preferences and restores conflicting storage", async () => {
    window.localStorage.setItem(workspaceStorageKey, "real-workspace");
    window.localStorage.setItem(navStorageKey, "1");
    window.localStorage.setItem(layoutStorageKey, realLayoutValue);
    const fixtureScreens = [
      ["01-inbox", "Inbox clear"],
      ["04-missions", "PocketPup mission"],
      ["06-brainstorm", "No signals captured"],
    ] as const;

    for (const [screenId, expectedContent] of fixtureScreens) {
      const { unmount } = render(
        <MemoryRouter>
          <OrbitFloVisualReview screenId={screenId} />
        </MemoryRouter>,
      );

      if (screenId === "04-missions") {
        expect(await screen.findByRole("article", { name: expectedContent })).toBeVisible();
      } else {
        expect(await screen.findByText(expectedContent)).toBeVisible();
      }
      expect(window.localStorage.getItem(workspaceStorageKey)).toBe("visual-workspace");
      expect(window.localStorage.getItem(navStorageKey)).toBeNull();
      expect(window.localStorage.getItem(layoutStorageKey)).toBe(captureLayoutValue);
      expect(unexpectedSupabaseCall).not.toHaveBeenCalled();

      unmount();
      expect(window.localStorage.getItem(workspaceStorageKey)).toBe("real-workspace");
      expect(window.localStorage.getItem(navStorageKey)).toBe("1");
      expect(window.localStorage.getItem(layoutStorageKey)).toBe(realLayoutValue);
    }
  });

  it("restores initially absent capture storage after the harness unmounts", async () => {
    const { unmount } = render(
      <MemoryRouter>
        <OrbitFloVisualReview screenId="01-inbox" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Inbox clear")).toBeVisible();
    expect(window.localStorage.getItem(workspaceStorageKey)).toBe("visual-workspace");
    expect(window.localStorage.getItem(navStorageKey)).toBeNull();
    expect(window.localStorage.getItem(layoutStorageKey)).toBe(captureLayoutValue);

    unmount();
    expect(window.localStorage.getItem(workspaceStorageKey)).toBeNull();
    expect(window.localStorage.getItem(navStorageKey)).toBeNull();
    expect(window.localStorage.getItem(layoutStorageKey)).toBeNull();
  });
});
