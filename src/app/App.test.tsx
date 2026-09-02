import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { RouteFallback } from "./routes";

vi.mock("../components/global-quick-add", () => ({
  GlobalQuickAdd: () => <div>Quick add</div>,
}));

vi.mock("../components/command-palette", () => ({
  CommandPalette: () => <div>Command palette</div>,
}));

vi.mock("../features/auth/auth-callback-page", () => ({
  AuthCallbackPage: () => <div>Auth callback</div>,
}));

vi.mock("../features/auth/auth-page", () => ({
  AuthPage: () => <div>Auth page</div>,
}));

// The auth pages are routed non-lazily, so without these stubs their real
// modules pull the Supabase client into this graph and it throws on missing
// env vars — which is what CI runs without.
vi.mock("../features/auth/auth-reset-page", () => ({
  AuthResetPage: () => <div>Auth reset page</div>,
}));

vi.mock("../lib/supabase/client", () => ({ supabase: {} }));

// The workspace gate resolves the route param against this list before any
// page renders, so every authenticated assertion waits on it.
vi.mock("../features/workspaces/workspaces.queries", () => ({
  listWorkspaces: () => Promise.resolve([{ id: "workspace-1", name: "Personal" }]),
  workspacesQueryKey: ["workspaces"],
}));

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => ({
    isLoading: false,
    session: null,
    user: {
      id: "user-1",
    },
  }),
}));

vi.mock("./route-loaders", () => ({
  loadAgentPage: () => Promise.resolve({ default: () => <div>Agent page</div> }),
  loadCalendarPage: () => Promise.resolve({ default: () => <div>Calendar page</div> }),
  loadDailyMissionControlPage: () => Promise.resolve({ default: () => <div>Daily Mission Control page</div> }),
  loadDashboardPage: () => Promise.resolve({ default: () => <div>Dashboard page</div> }),
  loadFeaturesPage: () => Promise.resolve({ default: () => <div>Features page</div> }),
  loadInboxPage: () => Promise.resolve({ default: () => <div>Inbox page</div> }),
  loadMarketingHomePage: () => Promise.resolve({ default: () => <div>Landing page</div> }),
  loadMapsPage: () => Promise.resolve({ default: () => <h1>Visual planning workspace</h1> }),
  loadOpenSourcePage: () => Promise.resolve({ default: () => <div>Open source page</div> }),
  loadMilestonePage: () => Promise.resolve({ default: () => <div>Milestone page</div> }),
  loadNotesPage: () => Promise.resolve({ default: () => <div>Notes page</div> }),
  loadProjectWorkspacePage: () => Promise.resolve({ default: () => <div>Project workspace page</div> }),
  loadProjectsPage: () => Promise.resolve({ default: () => <div>Projects page</div> }),
  loadSettingsPage: () => Promise.resolve({ default: () => <div>Settings page</div> }),
  loadSignalsPage: () => Promise.resolve({ default: () => <div>Signals page</div> }),
  routePrefetchers: {
    "/": () => Promise.resolve(),
    "/calendar": () => Promise.resolve(),
    "/dashboard": () => Promise.resolve(),
    "/inbox": () => Promise.resolve(),
    "/maps": () => Promise.resolve(),
    "/notes": () => Promise.resolve(),
    "/projects": () => Promise.resolve(),
    "/settings": () => Promise.resolve(),
    "/signals": () => Promise.resolve(),
  },
}));

/**
 * main.tsx wraps App in AppProviders; the workspace gate is the first thing in
 * the tree to need a QueryClient, so the test mirrors that composition. The
 * gate renders a loader until the workspace list resolves.
 */
function renderAppAt(path: string) {
  window.history.pushState(null, "", path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

async function renderApp(path = "/w/workspace-1") {
  renderAppAt(path);
  await screen.findByTestId("app-shell");
}

describe("App", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/w/workspace-1");
  });

  it("renders a themed route loading shell", () => {
    render(<RouteFallback />);

    expect(screen.getByRole("status", { name: "Systems online" })).toBeTruthy();
    expect(screen.getByText("Synchronizing workspace telemetry.")).toBeTruthy();
  });

  it("renders the authenticated app shell dashboard", async () => {
    await renderApp();

    expect(screen.getByRole("img", { name: "Orbit Flo" })).toBeTruthy();
    const logo = screen.getByRole("img", { name: "Orbit Flo" });

    expect(logo.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/brand/orbit-flo-lockup-dark.png",
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    const primaryNavigation = within(screen.getByTestId("app-shell").querySelector("aside") as HTMLElement).getByRole(
      "navigation",
      { name: "Primary navigation" },
    );
    const sidebar = within(screen.getByTestId("app-shell").querySelector("aside") as HTMLElement);
    expect(primaryNavigation).toBeVisible();
    expect(primaryNavigation.closest("aside")).toHaveClass("bg-[#040b1d]");
    expect(primaryNavigation.closest("aside")).not.toHaveClass("backdrop-blur-xl");
    expect(sidebar.getByRole("link", { name: "Today" })).toHaveClass("orbit-nav-active");
    expect(screen.getByTestId("app-shell")).toHaveClass("lg:grid-cols-[14.5rem_minmax(0,1fr)]");
    expect(sidebar.getByRole("link", { name: "Today" })).toBeTruthy();
    expect(sidebar.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(sidebar.getByRole("link", { name: "Missions" })).toBeTruthy();
    expect(sidebar.getByRole("link", { name: "Maps" })).toBeTruthy();
    expect(sidebar.getByRole("link", { name: "Calendar" })).toBeTruthy();
    expect(sidebar.getByRole("link", { name: "Inbox" })).toBeTruthy();
    expect(sidebar.getByRole("link", { name: "Brainstorm" })).toBeTruthy();
    expect(sidebar.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("Command palette")).toBeTruthy();
    expect(await screen.findByText("Daily Mission Control page")).toBeTruthy();
  });

  it.each([
    ["Dashboard", "Dashboard page"],
    ["Missions", "Projects page"],
    ["Maps", "Visual planning workspace"],
    ["Calendar", "Calendar page"],
    ["Inbox", "Inbox page"],
    ["Brainstorm", "Notes page"],
    ["Settings", "Settings page"],
  ])("keeps shell content visible when navigating to %s", async (label, placeholder) => {
    const user = userEvent.setup();
    await renderApp();

    const sidebar = within(screen.getByTestId("app-shell").querySelector("aside") as HTMLElement);
    await user.click(sidebar.getByRole("link", { name: label }));

    expect(screen.getByRole("img", { name: "Orbit Flo" })).toBeTruthy();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    if (label === "Maps") {
      expect(await screen.findByRole("heading", { name: placeholder })).toBeTruthy();
    } else {
      expect(await screen.findByText(placeholder)).toBeTruthy();
    }
  });

  it("serves the password reset route outside the app shell", async () => {
    renderAppAt("/auth/reset");

    expect(await screen.findByText("Auth reset page")).toBeTruthy();
    expect(screen.queryByTestId("app-shell")).toBeNull();
  });

  it("renders the maps route inside the app shell", async () => {
    await renderApp("/w/workspace-1/maps");

    expect(screen.getByRole("img", { name: "Orbit Flo" })).toBeTruthy();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(await screen.findByRole("heading", { name: "Visual planning workspace" })).toBeTruthy();
  });

  it("collapses and expands the navigation rail with persistence", async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem("orbitflo:nav-collapsed");
    await renderApp();

    const sidebar = within(screen.getByTestId("app-shell").querySelector("aside") as HTMLElement);

    expect(sidebar.getByRole("link", { name: "Missions" })).toHaveTextContent("Missions");

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(sidebar.getByRole("link", { name: "Missions" })).not.toHaveTextContent("Missions");
    expect(window.localStorage.getItem("orbitflo:nav-collapsed")).toBe("1");

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));

    expect(sidebar.getByRole("link", { name: "Missions" })).toHaveTextContent("Missions");
    expect(window.localStorage.getItem("orbitflo:nav-collapsed")).toBeNull();
  });

  it("redirects a legacy path into the resolved workspace", async () => {
    await renderApp("/projects");

    expect(await screen.findByText("Projects page")).toBeTruthy();
    expect(window.location.pathname).toBe("/w/workspace-1/projects");
  });

  it("refuses a workspace the caller does not belong to", async () => {
    renderAppAt("/w/someone-elses-workspace");

    expect(await screen.findByText("This workspace is not yours to open.")).toBeTruthy();
    expect(screen.queryByTestId("app-shell")).toBeNull();
  });

  it("renders the project workspace route inside the app shell", async () => {
    await renderApp("/w/workspace-1/projects/project-1");

    expect(screen.getByRole("img", { name: "Orbit Flo" })).toBeTruthy();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(await screen.findByText("Project workspace page")).toBeTruthy();
  });
});
