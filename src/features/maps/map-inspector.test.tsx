import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EditableMapNode } from "./map-types";
import { MapInspector } from "./map-inspector";

const node: EditableMapNode = {
  id: "node-1",
  title: "Feature idea",
  body: "Capture the rough thought.",
  nodeType: "idea",
  status: "open",
  position: { x: 0, y: 0 },
  accent: "cyan",
  dueDate: null,
  tags: [],
};

describe("MapInspector", () => {
  it("updates the selected node title", async () => {
    const user = userEvent.setup();
    const onNodeChange = vi.fn();
    function Harness() {
      const [selectedNode, setSelectedNode] = useState(node);
      return (
        <MapInspector
          node={selectedNode}
          onConvert={() => undefined}
          onNodeChange={(updatedNode) => {
            setSelectedNode(updatedNode);
            onNodeChange(updatedNode);
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByText("Feature idea")).toBeInTheDocument();

    const title = screen.getByLabelText("Node title");
    await user.clear(title);
    await user.type(title, "Refined idea");

    expect(onNodeChange).toHaveBeenLastCalledWith({
      ...node,
      title: "Refined idea",
    });
  });

  it("converts the selected node to a task", async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();

    render(<MapInspector node={node} onConvert={onConvert} onNodeChange={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Convert to task" }));

    expect(onConvert).toHaveBeenCalledWith("task");
  });

  it("disables conversion actions while conversion is pending", async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();

    render(<MapInspector node={node} isConverting onConvert={onConvert} onNodeChange={() => undefined} />);

    const convertToTask = screen.getByRole("button", { name: "Convert to task" });
    expect(convertToTask).toBeDisabled();

    await user.click(convertToTask);

    expect(onConvert).not.toHaveBeenCalled();
  });

  it("shows the conversion disabled reason and blocks conversion", async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();

    render(
      <MapInspector
        node={node}
        conversionDisabledReason="Save this map before converting nodes."
        onConvert={onConvert}
        onNodeChange={() => undefined}
      />,
    );

    const convertToNote = screen.getByRole("button", { name: "Convert to note" });
    expect(screen.getByText("Save this map before converting nodes.")).toBeInTheDocument();
    expect(convertToNote).toBeDisabled();

    await user.click(convertToNote);

    expect(onConvert).not.toHaveBeenCalled();
  });

  it("can disable one conversion action without blocking the others", async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();

    render(
      <MapInspector
        node={node}
        conversionDisabledReasons={{ task: "Choose a project map before converting nodes to tasks." }}
        onConvert={onConvert}
        onNodeChange={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Convert to task" })).toBeDisabled();
    expect(screen.getByText("Choose a project map before converting nodes to tasks.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Convert to note" }));

    expect(onConvert).toHaveBeenCalledWith("note");
  });
});
