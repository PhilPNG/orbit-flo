import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { convertedHref, MapInspector, type MapInspectorProps } from "./map-inspector";
import type { EditableMapGraph, EditableMapNode } from "./map-types";

function node(id: string, extra: Partial<EditableMapNode> = {}): EditableMapNode {
  return { id, title: id, body: "", nodeType: "idea", status: "open", position: { x: 0, y: 0 }, accent: "cyan", tags: [], ...extra };
}

const graph: EditableMapGraph = {
  title: "Feature plan",
  description: "",
  defaultView: "mind_map",
  nodes: [node("root", { title: "Root", tags: ["alpha"] }), node("child", { title: "Child" })],
  edges: [{ id: "root-child", sourceNodeId: "root", targetNodeId: "child", edgeType: "association", label: "", isDirectional: false }],
};

function renderInspector(overrides: Partial<MapInspectorProps> = {}) {
  const onGraphChange = vi.fn<MapInspectorProps["onGraphChange"]>();
  const onSelect = vi.fn<MapInspectorProps["onSelect"]>();
  const onConvert = vi.fn<MapInspectorProps["onConvert"]>();
  const props: MapInspectorProps = {
    graph,
    selection: { kind: "node", id: "root" },
    workspaceId: "ws-1",
    projectId: "p-1",
    isConverting: false,
    conversionError: null,
    ...overrides,
    onGraphChange,
    onSelect,
    onConvert,
  };
  render(
    <MemoryRouter>
      <MapInspector {...props} />
    </MemoryRouter>,
  );
  return { ...props, onGraphChange, onSelect, onConvert };
}

describe("MapInspector", () => {
  it("edits the map title and description when nothing is selected", async () => {
    const user = userEvent.setup();
    const props = renderInspector({ selection: null });

    await user.type(screen.getByRole("textbox", { name: "Title" }), "!");

    const [next, options] = props.onGraphChange.mock.calls[0];
    expect(next.title).toBe("Feature plan!");
    expect(options).toEqual({ coalesceKey: "map:title" });
    expect(screen.getByText("Select a node or connection to edit it.")).toBeTruthy();
  });

  it("changes a node's type and accent", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "risk");

    const next = props.onGraphChange.mock.calls[0][0] as EditableMapGraph;
    expect(next.nodes[0]).toMatchObject({ nodeType: "risk", accent: "violet" });
  });

  it("changes a node's status and dates", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "selected");
    expect((props.onGraphChange.mock.calls[0][0] as EditableMapGraph).nodes[0].status).toBe("selected");

    await user.type(screen.getByLabelText("Due date"), "2026-10-01");
    const last = props.onGraphChange.mock.calls.at(-1)?.[0] as EditableMapGraph;
    expect(last.nodes[0].dueDate).toBe("2026-10-01");
  });

  it("adds tags with Enter or a comma and removes them", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.type(screen.getByRole("textbox", { name: "Add tag" }), "beta{Enter}");
    expect((props.onGraphChange.mock.calls[0][0] as EditableMapGraph).nodes[0].tags).toEqual(["alpha", "beta"]);

    await user.type(screen.getByRole("textbox", { name: "Add tag" }), "gamma,");
    expect((props.onGraphChange.mock.calls[1][0] as EditableMapGraph).nodes[0].tags).toEqual(["alpha", "gamma"]);

    await user.click(screen.getByRole("button", { name: "Remove tag alpha" }));
    expect((props.onGraphChange.mock.calls[2][0] as EditableMapGraph).nodes[0].tags).toEqual([]);
  });

  it("converts through the three buttons on a project map", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.click(screen.getByRole("button", { name: "Task" }));
    await user.click(screen.getByRole("button", { name: "Note" }));
    await user.click(screen.getByRole("button", { name: "Milestone" }));

    expect(props.onConvert.mock.calls.map(([type]) => type)).toEqual(["task", "note", "milestone"]);
  });

  it("disables task and milestone conversion on a global map", () => {
    renderInspector({ projectId: null });

    expect(screen.getByRole("button", { name: "Task" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Milestone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Note" })).not.toBeDisabled();
    expect(screen.getByText("Choose a project map to convert to a task or milestone.")).toBeTruthy();
  });

  it("shows the converted state with an Open link and the error when conversion fails", () => {
    const converted = {
      ...graph,
      nodes: [node("root", { status: "converted", convertedType: "task", convertedId: "t-1", convertedAt: "now" }), node("child")],
    };
    renderInspector({ graph: converted, conversionError: "boom" });

    expect(screen.getByText(/Converted to task/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open/ })).toHaveAttribute("href", "/w/ws-1/projects/p-1?task=t-1");
    expect(screen.queryByRole("button", { name: "Task" })).toBeNull();
    expect(screen.getByText("boom")).toBeTruthy();
  });

  it("deletes the node and clears the selection", async () => {
    const user = userEvent.setup();
    const props = renderInspector();

    await user.click(screen.getByRole("button", { name: "Delete node" }));

    const next = props.onGraphChange.mock.calls[0][0] as EditableMapGraph;
    expect(next.nodes.map((item) => item.id)).toEqual(["child"]);
    expect(next.edges).toEqual([]);
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });

  it("edits and deletes a connection", async () => {
    const user = userEvent.setup();
    const props = renderInspector({ selection: { kind: "edge", id: "root-child" } });

    expect(screen.getByText("Root → Child")).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "dependency");
    expect((props.onGraphChange.mock.calls[0][0] as EditableMapGraph).edges[0].edgeType).toBe("dependency");

    await user.click(screen.getByRole("switch", { name: "Directional" }));
    expect((props.onGraphChange.mock.calls[1][0] as EditableMapGraph).edges[0].isDirectional).toBe(true);

    await user.type(screen.getByRole("textbox", { name: "Label" }), "x");
    expect(props.onGraphChange.mock.calls[2][1]).toEqual({ coalesceKey: "edge:root-child:label" });

    await user.click(screen.getByRole("button", { name: "Delete connection" }));
    expect((props.onGraphChange.mock.calls[3][0] as EditableMapGraph).edges).toEqual([]);
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });
});

describe("convertedHref", () => {
  it("links each converted type to its page", () => {
    expect(convertedHref("ws", "p", node("n", { convertedType: "task", convertedId: "t" }))).toBe("/w/ws/projects/p?task=t");
    expect(convertedHref("ws", null, node("n", { convertedType: "task", convertedId: "t" }))).toBeNull();
    expect(convertedHref("ws", null, node("n", { convertedType: "note", convertedId: "x" }))).toBe("/w/ws/notes?note=x");
    expect(convertedHref("ws", null, node("n", { convertedType: "milestone", convertedId: "m" }))).toBe("/w/ws/milestones/m");
    expect(convertedHref("ws", null, node("n"))).toBeNull();
  });
});
