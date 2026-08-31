import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "../workspaces/workspace-context";
import { SignalsPage } from "./signals-page";

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));

const { listSignalsMock, countUnreadSignalsMock } = vi.hoisted(() => ({
  listSignalsMock: vi.fn().mockResolvedValue([
    {
      id: "s1", kind: "assigned", createdAt: "2026-08-18T00:00:00Z", readAt: null,
      actorId: "ada-id", actorName: "Ada", workItemId: "w1", noteId: null, targetTitle: "Ship the graph",
    },
  ]),
  // The page derives unread from this count, not from filtering the (capped)
  // list, so it agrees with the nav badge past the list's 50-row limit.
  countUnreadSignalsMock: vi.fn().mockResolvedValue(1),
}));

vi.mock("./signals.queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./signals.queries")>()),
  listSignals: listSignalsMock,
  countUnreadSignals: countUnreadSignalsMock,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceProvider workspaceId="ws1">
          <SignalsPage />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SignalsPage", () => {
  it("renders a sentence for each signal, naming the real target", async () => {
    renderPage();
    expect(await screen.findByText("Ada assigned you Ship the graph")).toBeInTheDocument();
  });

  it("falls back to a deleted task when the target is genuinely gone", async () => {
    listSignalsMock.mockResolvedValueOnce([
      {
        id: "s2", kind: "assigned", createdAt: "2026-08-18T00:00:00Z", readAt: null,
        actorId: null, actorName: "Ada", workItemId: "w-gone", noteId: null, targetTitle: null,
      },
    ]);

    renderPage();
    expect(await screen.findByText("Ada assigned you a deleted task")).toBeInTheDocument();
  });

  it("offers mark all read while something is unread", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Mark all read" })).toBeInTheDocument();
  });

  it("colours the avatar by actorId, not by the signal's own id, so the same person matches across rows", async () => {
    // Same actor, two different signal ids. Passing signal.id as the avatar's
    // userId would give these two rows different colours for no reason.
    listSignalsMock.mockResolvedValueOnce([
      {
        id: "s1", kind: "assigned", createdAt: "2026-08-18T00:00:00Z", readAt: null,
        actorId: "same-actor", actorName: "Ada", workItemId: "w1", noteId: null, targetTitle: "Ship the graph",
      },
      {
        id: "s2", kind: "commented", createdAt: "2026-08-18T00:01:00Z", readAt: null,
        actorId: "same-actor", actorName: "Ada", workItemId: "w1", noteId: null, targetTitle: "Ship the graph",
      },
    ]);

    renderPage();
    const avatars = await screen.findAllByRole("img", { name: "Ada" });
    expect(avatars).toHaveLength(2);
    expect(avatars[0].className).toBe(avatars[1].className);
  });
});
