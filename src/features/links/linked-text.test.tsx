import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LinkedText, targetKey } from "./linked-text";

vi.mock("../workspaces/workspace-context", () => ({ useWorkspaceId: () => "workspace-1" }));

const taskId = "8f3c1d2e-1111-4222-8333-444455556666";

function renderBody(body: string, resolved?: Set<string>) {
  return render(
    <MemoryRouter>
      <LinkedText body={body} resolved={resolved} />
    </MemoryRouter>,
  );
}

describe("LinkedText", () => {
  it("renders a link into the workspace", () => {
    renderBody(`Blocked by [Polish the release path](orbit:task/${taskId}).`);

    expect(screen.getByRole("link", { name: "Polish the release path" })).toHaveAttribute(
      "href",
      `/w/workspace-1/projects?task=${taskId}`,
    );
  });

  it("keeps the surrounding prose", () => {
    const { container } = renderBody(`before [Task](orbit:task/${taskId}) after`);

    expect(container.textContent).toBe("before Task after");
  });

  it("shows a deleted target as broken rather than rewriting the note", () => {
    renderBody(`See [Gone](orbit:task/${taskId})`, new Set());

    expect(screen.queryByRole("link", { name: "Gone" })).toBeNull();
    expect(screen.getByText("Gone")).toBeVisible();
  });

  it("links a target that still exists", () => {
    renderBody(`See [Here](orbit:task/${taskId})`, new Set([targetKey("task", taskId)]));

    expect(screen.getByRole("link", { name: "Here" })).toBeTruthy();
  });

  it("renders markup in the body as text, never as HTML", () => {
    const { container } = renderBody('<img src=x onerror="alert(1)">');

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("renders markdown structure, not just the raw characters", () => {
    renderBody(`## Heading

- one
- two

**bold**`);

    expect(screen.getByRole("heading", { name: "Heading" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("supports GFM tables and strikethrough", () => {
    renderBody(`| a | b |
| - | - |
| 1 | 2 |

~~gone~~`);

    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByText("gone").tagName).toBe("DEL");
  });

  it("opens an external link in a new tab", () => {
    renderBody("[docs](https://example.com)");

    const anchor = screen.getByRole("link", { name: "docs" });
    expect(anchor).toHaveAttribute("href", "https://example.com");
    expect(anchor).toHaveAttribute("rel", "noreferrer");
  });

  it("refuses a javascript: url rather than rendering it as a link", () => {
    renderBody("[click](javascript:alert(1))");

    expect(screen.queryByRole("link", { name: "click" })).toBeNull();
  });

  it("renders a mention as a chip rather than a link", () => {
    renderBody("Ask [@Ada](orbit:user/11111111-1111-1111-1111-111111111111) about it");

    // There is no user profile page, so a link would look clickable and do nothing.
    expect(screen.getByText("@Ada")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "@Ada" })).not.toBeInTheDocument();
  });

  it("keeps the orbit:user href through urlTransform", () => {
    // react-markdown strips unknown schemes by default, which would silently
    // destroy every mention before the renderer ever sees it.
    renderBody("[@Ada](orbit:user/11111111-1111-1111-1111-111111111111)");
    expect(screen.getByText("@Ada")).toBeInTheDocument();
  });

  it("renders a milestone link", () => {
    // orbitHref feeds both the anchor branch and urlTransform. If only the
    // branch were widened, react-markdown would strip the scheme and the link
    // would vanish with no href at all.
    renderBody("[Beta](orbit:milestone/11111111-1111-1111-1111-111111111111)");
    expect(screen.getByRole("link", { name: "Beta" })).toBeInTheDocument();
  });
});
