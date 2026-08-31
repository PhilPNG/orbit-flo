import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StarNode, type StarNodeData } from "./map-star-node";

vi.mock("@xyflow/react", () => ({
  Handle: ({ type }: { type: string }) => <span data-testid={`handle-${type}`} />,
  Position: { Left: "left", Right: "right" },
}));

function data(overrides: Partial<StarNodeData> = {}): StarNodeData {
  return {
    label: "Feature idea",
    accent: "cyan",
    shape: "dot",
    isConverted: false,
    isRenaming: false,
    onRenameCommit: () => undefined,
    onRenameCancel: () => undefined,
    ...overrides,
  };
}

describe("StarNode", () => {
  it("renders the star, title, and connection handles", () => {
    render(<StarNode data={data()} />);

    expect(screen.getByText("Feature idea").parentElement).toHaveClass("orbit-star-node-label");
    expect(screen.getByTestId("star-node-root")).not.toHaveClass("rounded-lg");
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-dot-cyan");
    expect(screen.getByTestId("handle-target")).toBeTruthy();
    expect(screen.getByTestId("handle-source")).toBeTruthy();
  });

  it("shows beacon styling only when selected and keeps the converted badge", () => {
    const { rerender } = render(<StarNode data={data({ isConverted: true, accent: "violet" })} />);

    expect(screen.getByTestId("star-node-root")).not.toHaveClass("star-node-selected");
    expect(screen.getByTestId("star-converted-badge")).toBeTruthy();

    rerender(<StarNode data={data({ isConverted: true, accent: "violet" })} selected />);

    expect(screen.getByTestId("star-node-root")).toHaveClass("star-node-selected");
    expect(screen.getByTestId("star-converted-badge")).toBeTruthy();
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-dot-violet");
  });

  it("keeps a converted badge visible beside a long truncated title", () => {
    const longLabel = "A very long converted node title that must not hide its planet badge";
    render(<StarNode data={data({ isConverted: true, label: longLabel })} />);

    const label = screen.getByText(longLabel);
    const capsule = label.parentElement;
    const badge = screen.getByTestId("star-converted-badge");

    expect(label).toHaveClass("min-w-0", "truncate");
    expect(capsule).toHaveClass("orbit-star-node-label", "max-w-52");
    expect(capsule).not.toHaveClass("truncate");
    expect(capsule).toContainElement(badge);
    expect(label.nextElementSibling).toBe(badge);
    expect(badge).toHaveClass("shrink-0");
  });

  it("renders a glyph per shape", () => {
    const { rerender } = render(<StarNode data={data({ shape: "diamond", accent: "violet" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-diamond");

    rerender(<StarNode data={data({ shape: "triangle", accent: "violet" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-triangle");

    rerender(<StarNode data={data({ shape: "planet" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-planet");

    rerender(<StarNode data={data({ shape: "card", accent: "blue" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-card");

    rerender(<StarNode data={data({ shape: "ring", accent: "blue" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-glyph-ring");

    rerender(<StarNode data={data({ shape: "dot" })} />);
    expect(screen.getByTestId("star-glyph")).toHaveClass("star-dot");
  });

  it("renames inline with Enter and cancels with Escape", async () => {
    const user = userEvent.setup();
    const onRenameCommit = vi.fn();
    const onRenameCancel = vi.fn();

    render(<StarNode data={data({ isRenaming: true, onRenameCommit, onRenameCancel })} />);

    const input = screen.getByRole("textbox", { name: "Node title" });
    expect(input).toHaveValue("Feature idea");

    await user.clear(input);
    await user.type(input, "Better idea{Enter}");
    expect(onRenameCommit).toHaveBeenCalledWith("Better idea");

    await user.type(input, "{Escape}");
    expect(onRenameCancel).toHaveBeenCalled();
  });
});
