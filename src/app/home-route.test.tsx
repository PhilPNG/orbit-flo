import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const authState = { isLoading: false, session: null, user: null as null | { id: string } };

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => authState,
}));

vi.mock("../features/workspaces/workspace-redirect", () => ({
  WorkspaceRedirect: () => <div>workspace redirect</div>,
}));

vi.mock("./route-loaders", () => ({
  loadLandingPage: () => Promise.resolve({ default: () => <div>landing page</div> }),
}));

import { HomeRoute } from "./home-route";

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeRoute />
    </MemoryRouter>,
  );
}

afterEach(() => {
  authState.isLoading = false;
  authState.user = null;
});

describe("HomeRoute", () => {
  it("shows the landing page to a signed-out visitor", async () => {
    renderHome();

    expect(await screen.findByText("landing page")).toBeVisible();
  });

  it("keeps the signed-in redirect exactly as before", () => {
    authState.user = { id: "user-1" };
    renderHome();

    expect(screen.getByText("workspace redirect")).toBeVisible();
    expect(screen.queryByText("landing page")).toBeNull();
  });

  it("shows the loader while auth is still resolving", () => {
    authState.isLoading = true;
    renderHome();

    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByText("landing page")).toBeNull();
  });
});
