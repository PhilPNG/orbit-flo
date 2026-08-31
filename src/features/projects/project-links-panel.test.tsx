import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProjectLink } from "./project-links.queries";
import { ProjectLinksPanel } from "./project-links-panel";

function link(overrides: Partial<ProjectLink> = {}): ProjectLink {
  return {
    id: "link-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    link_type: "repository",
    label: "Repository",
    url: "https://github.com/example/repo",
    created_by: "user-1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProjectLinksPanel", () => {
  it("renders each link as a safe external anchor", () => {
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const anchor = screen.getByRole("link", { name: /Repository/ });
    expect(anchor).toHaveAttribute("href", "https://github.com/example/repo");
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("github.com")).toBeTruthy();
  });

  it("refuses to render a dangerous URL as a link", () => {
    render(
      <ProjectLinksPanel
        links={[link({ url: "javascript:alert(1)", label: "Sketchy" })]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link", { name: /Sketchy/ })).toBeNull();
    expect(screen.getByText("Sketchy")).toBeTruthy();
  });

  it("invites the first link when there are none", () => {
    render(<ProjectLinksPanel links={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("No links yet. Add the repository, docs, or deployment.")).toBeTruthy();
  });

  it("submits a new link with the chosen type", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Link type"), "documentation");
    await user.type(screen.getByLabelText("Label"), "Docs");
    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(onCreate).toHaveBeenCalledWith({
      linkType: "documentation",
      label: "Docs",
      url: "https://example.com/docs",
    });
  });

  it("passes a blank label through so the query can default it", async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(onCreate).toHaveBeenCalledWith({
      linkType: "repository",
      label: "",
      url: "https://example.com/docs",
    });
  });

  it("clears the form after a successful add", async () => {
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(screen.getByLabelText("URL")).toHaveValue("");
  });

  it("keeps the draft when the add fails", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[]} onCreate={onCreate} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.type(screen.getByLabelText("URL"), "https://example.com/docs");
    await user.click(screen.getByRole("button", { name: "Add link" }));

    expect(screen.getByLabelText("URL")).toHaveValue("https://example.com/docs");
  });

  it("deletes a link by id", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={onDelete} />);

    const row = screen.getByRole("listitem");
    await user.click(within(row).getByRole("button", { name: "Remove Repository" }));

    expect(onDelete).toHaveBeenCalledWith("link-1");
  });

  it("edits a link in place, prefilled with its current values", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));

    const row = screen.getByRole("listitem");
    expect(within(row).getByLabelText("Label")).toHaveValue("Repository");
    expect(within(row).getByLabelText("URL")).toHaveValue("https://github.com/example/repo");

    await user.clear(within(row).getByLabelText("Label"));
    await user.type(within(row).getByLabelText("Label"), "Main repo");
    await user.click(within(row).getByRole("button", { name: "Save link" }));

    expect(onUpdate).toHaveBeenCalledWith("link-1", {
      linkType: "repository",
      label: "Main repo",
      url: "https://github.com/example/repo",
    });
  });

  it("closes the editor after a successful save", async () => {
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(screen.queryByRole("button", { name: "Save link" })).toBeNull();
    expect(screen.getByRole("link", { name: /Repository/ })).toBeTruthy();
  });

  it("keeps the editor open when the save fails", async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(screen.getByRole("button", { name: "Save link" })).toBeTruthy();
  });

  it("discards the draft on cancel", async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<ProjectLinksPanel links={[link()]} onCreate={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Edit Repository" }));
    await user.type(within(screen.getByRole("listitem")).getByLabelText("Label"), " edited");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Repository/ })).toBeTruthy();
  });

  it("shows the error the workspace hands it", () => {
    render(
      <ProjectLinksPanel
        errorMessage="Links must start with http:// or https://."
        links={[]}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Links must start with http:// or https://.",
    );
  });
});
