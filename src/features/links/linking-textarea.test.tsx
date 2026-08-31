import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkingTextarea } from "./linking-textarea";

const searchMocks = vi.hoisted(() => ({ searchWorkspace: vi.fn() }));
const memberMocks = vi.hoisted(() => ({ listMembers: vi.fn() }));

vi.mock("../../lib/supabase/client", () => ({ supabase: {} }));
vi.mock("../workspaces/workspace-context", () => ({ useWorkspaceId: () => "workspace-1" }));

vi.mock("../search/search.queries", () => ({
  searchWorkspace: searchMocks.searchWorkspace,
  minSearchLength: 2,
  searchKeys: { workspace: (workspaceId: string, term: string) => ["search", workspaceId, term] },
}));

vi.mock("../members/members.queries", () => ({
  listMembers: memberMocks.listMembers,
  membersQueryKey: (workspaceId: string) => ["workspace-members", workspaceId],
}));

const taskId = "8f3c1d2e-1111-4222-8333-444455556666";

function Harness() {
  const [value, setValue] = useState("");

  return <LinkingTextarea aria-label="Body" onChange={setValue} value={value} />;
}

function renderTextarea() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
}

// userEvent treats [ as the start of a key-code descriptor, so a literal
// bracket is typed as [[ — meaning the [[ trigger is written as [[[[.
describe("LinkingTextarea", () => {
  beforeEach(() => {
    searchMocks.searchWorkspace.mockReset();
    searchMocks.searchWorkspace.mockResolvedValue([
      { id: taskId, type: "task", title: "Polish the release path", subtitle: null, to: "", matchedTitle: true, updatedAt: "" },
    ]);

    memberMocks.listMembers.mockReset();
    memberMocks.listMembers.mockResolvedValue([
      { id: "member-1", userId: "user-ada", role: "member", displayName: "Ada Lovelace" },
    ]);
  });

  it("stays out of the way until the trigger is typed", async () => {
    const user = userEvent.setup();
    renderTextarea();

    await user.type(screen.getByLabelText("Body"), "ordinary prose");

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("offers matches once you type [[ and a term", async () => {
    const user = userEvent.setup();
    renderTextarea();

    await user.type(screen.getByLabelText("Body"), "blocked by [[[[pol");

    expect(await screen.findByRole("option", { name: /Polish the release path/ })).toBeTruthy();
  });

  it("inserts a link that stores the id, not the title", async () => {
    const user = userEvent.setup();
    renderTextarea();

    const field = screen.getByLabelText("Body");
    await user.type(field, "blocked by [[[[pol");
    await user.click(await screen.findByRole("option", { name: /Polish the release path/ }));

    expect(field).toHaveValue(`blocked by [Polish the release path](orbit:task/${taskId})`);
  });

  it("closes on Escape without inserting anything", async () => {
    const user = userEvent.setup();
    renderTextarea();

    const field = screen.getByLabelText("Body");
    await user.type(field, "blocked by [[[[pol");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field).toHaveValue("blocked by [[pol");
  });

  it("degrades to a plain textarea when the search fails", async () => {
    searchMocks.searchWorkspace.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderTextarea();

    const field = screen.getByLabelText("Body");
    await user.type(field, "blocked by [[[[pol");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field).toHaveValue("blocked by [[pol");
  });

  it("offers workspace members after @", async () => {
    const user = userEvent.setup();
    renderTextarea();

    // userEvent treats [ as a key-code descriptor; @ needs no escaping.
    await user.type(screen.getByLabelText("Body"), "@ad");

    expect(await screen.findByRole("listbox", { name: "Mention" })).toBeInTheDocument();
  });

  it("inserts a mention that carries the user id, not the membership id", async () => {
    const user = userEvent.setup();
    renderTextarea();

    const field = screen.getByLabelText("Body");
    await user.type(field, "ping @ad");
    await user.click(await screen.findByRole("option", { name: /Ada Lovelace/ }));

    expect(field).toHaveValue("ping [@Ada Lovelace](orbit:user/user-ada)");
  });
});
