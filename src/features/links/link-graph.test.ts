import { describe, expect, it } from "vitest";
import { buildLinkGraph } from "./link-graph";

const noteA = "aaaaaaaa-1111-4222-8333-444455556666";
const noteB = "bbbbbbbb-1111-4222-8333-444455556666";
const task = "8f3c1d2e-1111-4222-8333-444455556666";

const titles = {
  note: new Map([
    [noteA, "Why we shipped small"],
    [noteB, "Rollout risks"],
  ]),
  task: new Map([[task, "Polish the release path"]]),
  project: new Map<string, string>(),
  milestone: new Map<string, string>(),
};

describe("buildLinkGraph", () => {
  it("is empty when nothing links to anything", () => {
    expect(buildLinkGraph([], titles)).toEqual({ nodes: [], edges: [] });
  });

  it("includes both ends of a link", () => {
    const graph = buildLinkGraph(
      [{ noteId: noteA, targetKind: "task", targetId: task }],
      titles,
    );

    expect(graph.nodes.map((node) => node.id).sort()).toEqual([`note:${noteA}`, `task:${task}`]);
    expect(graph.edges).toEqual([
      { id: `note:${noteA}->task:${task}`, source: `note:${noteA}`, target: `task:${task}` },
    ]);
  });

  it("leaves out anything with no links at all", () => {
    const graph = buildLinkGraph(
      [{ noteId: noteA, targetKind: "task", targetId: task }],
      titles,
    );

    // noteB has a title but no links, so it is not part of the graph.
    expect(graph.nodes.some((node) => node.id === `note:${noteB}`)).toBe(false);
  });

  it("names each node from the titles it was given", () => {
    const graph = buildLinkGraph(
      [{ noteId: noteA, targetKind: "task", targetId: task }],
      titles,
    );

    expect(graph.nodes.find((node) => node.id === `note:${noteA}`)?.label).toBe(
      "Why we shipped small",
    );
  });

  it("falls back rather than rendering a blank node", () => {
    const graph = buildLinkGraph(
      [{ noteId: "unknown-id", targetKind: "task", targetId: task }],
      titles,
    );

    expect(graph.nodes.find((node) => node.id === "note:unknown-id")?.label).toBe("Untitled");
  });

  it("counts how many links touch each node", () => {
    const graph = buildLinkGraph(
      [
        { noteId: noteA, targetKind: "task", targetId: task },
        { noteId: noteB, targetKind: "task", targetId: task },
      ],
      titles,
    );

    expect(graph.nodes.find((node) => node.id === `task:${task}`)?.degree).toBe(2);
    expect(graph.nodes.find((node) => node.id === `note:${noteA}`)?.degree).toBe(1);
  });

  it("separates the kinds into their own columns", () => {
    const graph = buildLinkGraph(
      [{ noteId: noteA, targetKind: "task", targetId: task }],
      titles,
    );

    const note = graph.nodes.find((node) => node.kind === "note");
    const taskNode = graph.nodes.find((node) => node.kind === "task");

    expect(note?.position.x).not.toBe(taskNode?.position.x);
  });

  it("lays out identically for the same input, so the view does not jump", () => {
    const links = [
      { noteId: noteA, targetKind: "task" as const, targetId: task },
      { noteId: noteB, targetKind: "task" as const, targetId: task },
    ];

    expect(buildLinkGraph(links, titles)).toEqual(buildLinkGraph(links, titles));
  });

  it("keeps one node when a note links the same target twice", () => {
    const graph = buildLinkGraph(
      [
        { noteId: noteA, targetKind: "task", targetId: task },
        { noteId: noteA, targetKind: "task", targetId: task },
      ],
      titles,
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
  });

  it("gives milestones their own column", () => {
    const graph = buildLinkGraph(
      [{ noteId: "n1", targetKind: "milestone", targetId: "m1" }],
      {
        note: new Map([["n1", "A note"]]),
        task: new Map(),
        project: new Map(),
        milestone: new Map([["m1", "Beta"]]),
      },
    );

    const milestone = graph.nodes.find((node) => node.kind === "milestone");
    const note = graph.nodes.find((node) => node.kind === "note");

    expect(milestone?.label).toBe("Beta");
    // Distinct columns keep the layout readable and deterministic.
    expect(milestone?.position.x).not.toBe(note?.position.x);
  });
});
