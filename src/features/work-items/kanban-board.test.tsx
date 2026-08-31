import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase/database.types";
import type { BoardColumn } from "./board-columns.queries";
import { groupItemsByColumn, KanbanBoard } from "./kanban-board";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];


/** jsdom has no matchMedia, and the board asks it whether the pointer is coarse. */
function matchMediaCoarse(isCoarse: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("coarse") ? isCoarse : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function column(overrides: Partial<BoardColumn> = {}): BoardColumn {
  return {
    id: "col-todo",
    workspace_id: "workspace-1",
    project_id: "project-1",
    title: "Todo",
    status_category: "backlog",
    sort_order: 0,
    created_by: "user-1",
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "work-item-1",
    workspace_id: "workspace-1",
    project_id: "project-1",
    milestone_id: null,
    assigned_to: null,
    column_id: null,
    recurrence_rule_id: null,
    occurrence_date: null,
    planned_at: null,
    planned_minutes: null,
    title: "Wire timeline",
    description: null,
    status: "backlog",
    priority: "high",
    due_date: null,
    estimate_points: null,
    sort_order: 0,
    blocked_reason: null,
    created_by: "user-1",
    created_at: "2026-06-28T00:00:00.000Z",
    updated_at: "2026-06-28T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

const todoColumn = column();
const doneColumn = column({ id: "col-done", title: "Done", status_category: "done", sort_order: 1 });
const columns = [todoColumn, doneColumn];

function noopHandlers() {
  return {
    onMoveItem: vi.fn(),
    onRenameColumn: vi.fn(),
    onDeleteColumn: vi.fn(),
    onAddColumn: vi.fn(),
    onReorderColumns: vi.fn(),
  };
}

function fakeDataTransfer() {
  const data = new Map<string, string>();
  return {
    setData(type: string, value: string) {
      data.set(type, value);
    },
    getData(type: string) {
      return data.get(type) ?? "";
    },
  };
}

describe("groupItemsByColumn", () => {
  it("places items by column id, falls back to status category, then first column", () => {
    const items = [
      workItem({ id: "by-column", column_id: "col-done", status: "backlog" }),
      workItem({ id: "by-status", column_id: null, status: "done" }),
      workItem({ id: "orphan", column_id: "col-missing", status: "in_progress" }),
    ];

    const grouped = groupItemsByColumn(columns, items);

    expect(grouped.get("col-done")?.map((item) => item.id)).toEqual(["by-column", "by-status"]);
    expect(grouped.get("col-todo")?.map((item) => item.id)).toEqual(["orphan"]);
  });
});

describe("KanbanBoard", () => {
  it("renders items in their fallback columns", () => {
    render(
      <KanbanBoard
        columns={columns}
        items={[workItem({ title: "Ship it", status: "done" })]}
        {...noopHandlers()}
      />,
    );

    const done = screen.getByRole("region", { name: "Done column" });
    expect(within(done).getByText("Ship it")).toBeTruthy();
  });

  it("renames a column inline", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();

    render(<KanbanBoard columns={columns} items={[]} {...handlers} />);

    await user.click(screen.getByRole("button", { name: "Rename Todo column" }));
    const input = screen.getByLabelText("Column name");
    await user.clear(input);
    await user.type(input, "Up next{Enter}");

    expect(handlers.onRenameColumn).toHaveBeenCalledWith("col-todo", "Up next");
  });

  it("adds a column from the ghost tile", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();

    render(<KanbanBoard columns={columns} items={[]} {...handlers} />);

    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByLabelText("New column name"), "QA");
    await user.selectOptions(screen.getByLabelText("New column category"), "in_progress");
    await user.click(screen.getByRole("button", { name: "Create column" }));

    expect(handlers.onAddColumn).toHaveBeenCalledWith("QA", "in_progress");
  });

  it("deletes an empty column through the options menu", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();

    render(<KanbanBoard columns={columns} items={[]} {...handlers} />);

    await user.click(screen.getByRole("button", { name: "Done column options" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete column" }));

    expect(handlers.onDeleteColumn).toHaveBeenCalledWith(doneColumn, undefined);
  });

  it("starts a rename from the options menu", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();

    render(<KanbanBoard columns={columns} items={[]} {...handlers} />);

    await user.click(screen.getByRole("button", { name: "Todo column options" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename column" }));

    expect(screen.getByLabelText("Column name")).toHaveValue("Todo");
  });

  it("asks where to move items before deleting a non-empty column", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();

    render(
      <KanbanBoard
        columns={columns}
        items={[workItem({ status: "done", column_id: "col-done" })]}
        {...handlers}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Done column options" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete column" }));
    expect(handlers.onDeleteColumn).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Move tasks to"), "col-todo");
    await user.click(screen.getByRole("button", { name: "Delete and move tasks" }));

    expect(handlers.onDeleteColumn).toHaveBeenCalledWith(doneColumn, todoColumn);
  });

  it("reorders columns by dragging a header onto another column", () => {
    const handlers = noopHandlers();

    render(<KanbanBoard columns={columns} items={[]} {...handlers} />);

    const dataTransfer = fakeDataTransfer();
    const doneHeader = screen.getByRole("button", { name: "Rename Done column" }).closest("header") as HTMLElement;

    fireEvent.dragStart(doneHeader, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Todo column" }), { dataTransfer });

    expect(handlers.onReorderColumns).toHaveBeenCalledWith(["col-done", "col-todo"]);
  });

  it("moves a card dropped on another column", () => {
    const handlers = noopHandlers();

    render(
      <KanbanBoard
        columns={columns}
        items={[workItem({ id: "wi-1", status: "backlog" })]}
        {...handlers}
      />,
    );

    const dataTransfer = fakeDataTransfer();
    const card = screen.getByText("Wire timeline").closest("article") as HTMLElement;

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Done column" }), { dataTransfer });

    expect(handlers.onMoveItem).toHaveBeenCalledWith("wi-1", doneColumn);
  });

  it("shows a raised preview and target while a card is dragged", () => {
    const readyColumn = column({
      id: "col-ready",
      title: "Ready to Launch",
      status_category: "ready",
      sort_order: 1,
    });
    const polishItem = workItem({
      id: "polish",
      column_id: "col-todo",
      title: "Polish the release path",
    });
    const handlers = noopHandlers();
    const dataTransfer = fakeDataTransfer();
    const { container } = render(
      <KanbanBoard
        columns={[todoColumn, readyColumn]}
        items={[polishItem]}
        onOpenItem={() => undefined}
        {...handlers}
      />,
    );
    const card = screen.getByRole("button", { name: /Open Polish the release path/ });
    const target = screen.getByRole("region", { name: "Ready to Launch column" });

    const dragStartEvent = createEvent.dragStart(card, { dataTransfer });
    Object.defineProperties(dragStartEvent, {
      clientX: { value: 480 },
      clientY: { value: 520 },
    });
    fireEvent(card, dragStartEvent);

    const dragOverEvent = createEvent.dragOver(target, { dataTransfer });
    Object.defineProperties(dragOverEvent, {
      clientX: { value: 650 },
      clientY: { value: 520 },
    });
    fireEvent(target, dragOverEvent);

    const preview = container.querySelector(".kanban-drag-preview");
    expect(preview).toHaveTextContent("Polish the release path");
    expect(preview).toHaveClass("surface-focus");
    expect((preview as HTMLElement).style.left).toBe("664px");
    expect((preview as HTMLElement).style.pointerEvents).toBe("none");
    expect((preview as HTMLElement).style.top).toBe("534px");
    expect(target).toHaveClass("kanban-drop-target");
    expect(card.closest("[data-kanban-card]")).toHaveClass("kanban-drag-source");

    fireEvent.drop(target, { clientX: 650, clientY: 520, dataTransfer });

    expect(container.querySelector(".kanban-drag-preview")).toBeNull();
    expect(target).not.toHaveClass("kanban-drop-target");
    expect(card.closest("[data-kanban-card]")).not.toHaveClass("kanban-drag-source");
    expect(handlers.onMoveItem).toHaveBeenCalledWith("polish", readyColumn);
  });

  it("updates the item preview and clears the target when dragging through a board gutter", () => {
    const readyColumn = column({
      id: "col-ready",
      title: "Ready to Launch",
      status_category: "ready",
      sort_order: 1,
    });
    const dataTransfer = fakeDataTransfer();
    const { container } = render(
      <KanbanBoard
        columns={[todoColumn, readyColumn]}
        items={[
          workItem({
            id: "polish",
            column_id: "col-todo",
            title: "Polish the release path",
          }),
        ]}
        {...noopHandlers()}
      />,
    );
    const card = screen.getByText("Polish the release path").closest("article") as HTMLElement;
    const ready = screen.getByRole("region", { name: "Ready to Launch column" });
    const board = container.firstElementChild as HTMLElement;

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(ready, { dataTransfer });
    expect(ready).toHaveClass("kanban-drop-target");

    const gutterDragOver = createEvent.dragOver(board, { dataTransfer });
    Object.defineProperties(gutterDragOver, {
      clientX: { value: 720 },
      clientY: { value: 580 },
    });
    fireEvent(board, gutterDragOver);

    const preview = container.querySelector(".kanban-drag-preview") as HTMLElement;
    expect(preview.style.left).toBe("734px");
    expect(preview.style.top).toBe("594px");
    expect(ready).not.toHaveClass("kanban-drop-target");
  });

  it("clears item drag state on dragend without activating it for column drags", () => {
    const dataTransfer = fakeDataTransfer();
    const { container } = render(
      <KanbanBoard columns={columns} items={[workItem({ column_id: "col-todo" })]} {...noopHandlers()} />,
    );
    const card = screen.getByText("Wire timeline").closest("article") as HTMLElement;

    fireEvent.dragStart(card, { clientX: 120, clientY: 180, dataTransfer });
    expect(container.querySelector(".kanban-drag-preview")).not.toBeNull();

    fireEvent.dragEnd(card, { dataTransfer });
    expect(container.querySelector(".kanban-drag-preview")).toBeNull();

    const columnDataTransfer = fakeDataTransfer();
    const doneHeader = screen.getByRole("button", { name: "Rename Done column" }).closest("header") as HTMLElement;
    fireEvent.dragStart(doneHeader, { clientX: 20, clientY: 30, dataTransfer: columnDataTransfer });
    fireEvent.dragOver(screen.getByRole("region", { name: "Todo column" }), {
      clientX: 40,
      clientY: 50,
      dataTransfer: columnDataTransfer,
    });

    expect(container.querySelector(".kanban-drag-preview")).toBeNull();
    expect(screen.getByRole("region", { name: "Todo column" })).not.toHaveClass("kanban-drop-target");
  });

  it("renders meta badges and hides zero counts", () => {
    const meta = {
      labelsByItem: new Map([
        [
          "wi-1",
          [
            { id: "l1", workspace_id: "workspace-1", project_id: "project-1", name: "Design", color: "violet" as const, created_by: "u", created_at: "", updated_at: "" },
            { id: "l2", workspace_id: "workspace-1", project_id: "project-1", name: "Backend", color: "cyan" as const, created_by: "u", created_at: "", updated_at: "" },
          ],
        ],
      ]),
      checklistByItem: new Map([["wi-1", { done: 1, total: 2 }]]),
      commentCountByItem: new Map([["wi-1", 3]]),
      attachmentCountByItem: new Map<string, number>(),
    };

    render(
      <KanbanBoard
        columns={columns}
        items={[workItem({ id: "wi-1", status: "backlog" })]}
        meta={meta}
        {...noopHandlers()}
      />,
    );

    const labelRow = screen.getByLabelText("Labels");
    expect(labelRow.childElementCount).toBe(2);
    expect(screen.getByLabelText("Checklist 1 of 2")).toHaveTextContent("1/2");
    expect(screen.getByLabelText("3 comments")).toBeTruthy();
    expect(screen.queryByLabelText(/attachments/)).toBeNull();
  });

  it("moves a card through the accessible select", async () => {
    const user = userEvent.setup();
    const handlers = noopHandlers();

    render(
      <KanbanBoard
        columns={columns}
        items={[workItem({ id: "wi-1", status: "backlog" })]}
        {...handlers}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Move Wire timeline to"), "col-done");

    expect(handlers.onMoveItem).toHaveBeenCalledWith("wi-1", doneColumn);
  });

  it("lets go of an abandoned drag instead of stranding the preview", () => {
    const readyColumn = column({
      id: "col-ready",
      title: "Ready to Launch",
      status_category: "ready",
      sort_order: 1,
    });
    const polishItem = workItem({
      id: "polish",
      column_id: "col-todo",
      title: "Polish the release path",
    });
    const handlers = noopHandlers();
    const dataTransfer = fakeDataTransfer();
    const { container } = render(
      <KanbanBoard
        columns={[todoColumn, readyColumn]}
        items={[polishItem]}
        onOpenItem={() => undefined}
        {...handlers}
      />,
    );
    const card = screen.getByRole("button", { name: /Open Polish the release path/ });

    // A touch-initiated drag on Android starts, moves, and then simply stops:
    // no drop, no dragend. Nothing else may clear the preview.
    fireEvent.dragStart(card, { dataTransfer });
    expect(container.querySelector(".kanban-drag-preview")).not.toBeNull();

    fireEvent.pointerDown(document.body);

    expect(container.querySelector(".kanban-drag-preview")).toBeNull();
  });

  it("previews a description as text, not markup", async () => {
    render(
      <KanbanBoard
        columns={columns}
        items={[
          workItem({
            description: "Ship [the graph](orbit:task/8f2c1e04-1111-2222-3333-444455556666)",
          }),
        ]}
        {...noopHandlers()}
      />,
    );

    expect(await screen.findByText(/Ship the graph/)).toBeInTheDocument();
    expect(screen.queryByText(/orbit:task/)).not.toBeInTheDocument();
  });

  it("does not offer native drag on a touch device", () => {
    matchMediaCoarse(true);
    const readyColumn = column({
      id: "col-ready",
      title: "Ready to Launch",
      status_category: "ready",
      sort_order: 1,
    });
    const polishItem = workItem({
      id: "polish",
      column_id: "col-todo",
      title: "Polish the release path",
    });
    const handlers = noopHandlers();

    render(
      <KanbanBoard
        columns={[todoColumn, readyColumn]}
        items={[polishItem]}
        onOpenItem={() => undefined}
        {...handlers}
      />,
    );

    const card = screen
      .getByRole("button", { name: /Open Polish the release path/ })
      .closest("[data-kanban-card]");

    // Cards carry a column select for exactly this reason, so touch users lose
    // nothing by not having an unreliable native drag.
    expect(card).toHaveAttribute("draggable", "false");
  });
});
