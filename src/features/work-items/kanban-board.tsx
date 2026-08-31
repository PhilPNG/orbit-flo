import { clsx } from "clsx";
import { CheckSquare, MessageSquare, MoreHorizontal, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type DragEvent, type FormEvent, type PointerEvent } from "react";
import { ElectricBorder } from "../../components/electric-border";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import { staggerDelayMs } from "../../lib/stagger";
import { useRecentlyUpdated } from "../../lib/use-recently-updated";
import type { Database, ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";
import { toPlainText } from "../links/plain-text";
import type { BoardColumn } from "./board-columns.queries";
import { labelBarClasses, type WorkItemMeta } from "./work-item-details.queries";
import { workItemStatuses } from "./work-items.queries";
import { MemberAvatar } from "../profiles/member-avatar";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

const categoryLabels: Record<WorkItemStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In progress",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
};

function priorityTone(priority: ProjectPriority): StatusTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "good";
  return "neutral";
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}


/**
 * HTML5 drag is unreliable on touch: a drag can start and emit dragover but
 * never deliver dragend, which used to strand the preview on screen forever.
 * Cards carry a column select, so touch users lose nothing by not having it.
 */
function usePrefersNativeDrag() {
  const [prefersNativeDrag, setPrefersNativeDrag] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    setPrefersNativeDrag(!window.matchMedia("(pointer: coarse)").matches);
  }, []);

  return prefersNativeDrag;
}

export function groupItemsByColumn(columns: BoardColumn[], items: WorkItem[]) {
  const grouped = new Map<string, WorkItem[]>(columns.map((column) => [column.id, []]));
  if (columns.length === 0) return grouped;

  for (const item of items) {
    if (item.column_id && grouped.has(item.column_id)) {
      grouped.get(item.column_id)?.push(item);
      continue;
    }
    const fallback = columns.find((column) => column.status_category === item.status) ?? columns[0];
    grouped.get(fallback.id)?.push(item);
  }

  return grouped;
}

type KanbanBoardProps = {
  columns: BoardColumn[];
  items: WorkItem[];
  meta?: WorkItemMeta;
  assigneeNames?: Map<string, string>;
  isUpdating?: boolean;
  showAddColumn?: boolean;
  onOpenItem?: (id: string) => void;
  onMoveItem: (id: string, column: BoardColumn) => void;
  onRenameColumn: (id: string, title: string) => void;
  onDeleteColumn: (column: BoardColumn, moveItemsTo?: BoardColumn) => void;
  onAddColumn: (title: string, statusCategory: WorkItemStatus) => void;
  onReorderColumns: (orderedIds: string[]) => void;
};

export function KanbanBoard({
  columns,
  items,
  meta,
  assigneeNames,
  isUpdating = false,
  showAddColumn = true,
  onOpenItem,
  onMoveItem,
  onRenameColumn,
  onDeleteColumn,
  onAddColumn,
  onReorderColumns,
}: KanbanBoardProps) {
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [menuColumnId, setMenuColumnId] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnCategory, setNewColumnCategory] = useState<WorkItemStatus>("in_progress");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const prefersNativeDrag = usePrefersNativeDrag();

  // dragend is not guaranteed — a drag abandoned by the browser would
  // otherwise leave the preview stranded with no way to dismiss it.
  useEffect(() => {
    if (!draggedItemId) return undefined;

    function release() {
      setDraggedItemId(null);
      setDragOverColumnId(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") release();
    }

    document.addEventListener("pointerdown", release);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", release);

    return () => {
      document.removeEventListener("pointerdown", release);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", release);
    };
  }, [draggedItemId]);

  const grouped = groupItemsByColumn(columns, items);
  const draggedItem = items.find((item) => item.id === draggedItemId) ?? null;

  // updated_at is the field every mutation touches, so it is the signature of
  // "this card changed". Built inline on purpose: the hook compares content
  // rather than identity, so it does not need memoising.
  const recentlyUpdated = useRecentlyUpdated(
    new Map(items.map((item) => [item.id, item.updated_at ?? ""])),
  );

  function commitRename(columnId: string) {
    const title = renameDraft.trim();
    setRenamingColumnId(null);
    if (title) onRenameColumn(columnId, title);
  }

  function requestDelete(column: BoardColumn) {
    const columnItems = grouped.get(column.id) ?? [];
    if (columnItems.length === 0) {
      onDeleteColumn(column, undefined);
      return;
    }
    const firstOther = columns.find((candidate) => candidate.id !== column.id);
    setDeleteCandidateId(column.id);
    setMoveTargetId(firstOther?.id ?? "");
  }

  function confirmDelete(column: BoardColumn) {
    const target = columns.find((candidate) => candidate.id === moveTargetId);
    setDeleteCandidateId(null);
    if (target) onDeleteColumn(column, target);
  }

  function submitNewColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;

    onAddColumn(title, newColumnCategory);
    setNewColumnTitle("");
    setIsAddingColumn(false);
  }

  function beginItemDrag(event: DragEvent<HTMLElement>, itemId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `item:${itemId}`);
    setDraggedItemId(itemId);
    setDragPosition({ x: event.clientX, y: event.clientY });
  }

  function updateItemDrag(event: DragEvent<HTMLElement>) {
    if (!draggedItemId) return;
    event.preventDefault();

    const columnId =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-kanban-column-id]")?.dataset.kanbanColumnId ?? null
        : null;
    setDragOverColumnId(columnId);
    setDragPosition({ x: event.clientX, y: event.clientY });
  }

  function clearItemDrag() {
    setDraggedItemId(null);
    setDragOverColumnId(null);
  }

  // One listener for the whole board rather than one per card. With forty
  // cards, per-card handlers would mean forty layout reads per pointer move.
  function handleBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    const card = (event.target as HTMLElement).closest<HTMLElement>("[data-kanban-card]");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  function handleColumnDrop(event: DragEvent<HTMLElement>, targetColumn: BoardColumn) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) {
      if (draggedItemId) clearItemDrag();
      return;
    }

    if (payload.startsWith("column:")) {
      const draggedId = payload.slice("column:".length);
      if (draggedId === targetColumn.id) return;

      const remaining = columns.map((column) => column.id).filter((id) => id !== draggedId);
      const targetIndex = remaining.indexOf(targetColumn.id);
      remaining.splice(targetIndex, 0, draggedId);
      onReorderColumns(remaining);
      return;
    }

    const itemId = payload.startsWith("item:") ? payload.slice("item:".length) : payload;
    clearItemDrag();
    onMoveItem(itemId, targetColumn);
  }

  return (
    <div
      className="flex w-full items-start gap-3 overflow-x-auto pb-2"
      data-kanban-board
      onDragOver={updateItemDrag}
      onPointerMove={handleBoardPointerMove}
    >
      {columns.map((column) => {
        const columnItems = grouped.get(column.id) ?? [];
        const otherColumns = columns.filter((candidate) => candidate.id !== column.id);

        return (
          <section
            aria-label={`${column.title} column`}
            className={clsx(
              "orbit-panel-soft relative grid min-w-[12.5rem] flex-1 content-start gap-3 rounded-lg p-3",
              dragOverColumnId === column.id && "kanban-drop-target",
            )}
            data-kanban-column-id={column.id}
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleColumnDrop(event, column)}
            role="region"
          >
            {dragOverColumnId === column.id ? <ElectricBorder radius={12} /> : null}
            <header
              className="flex cursor-grab items-center justify-between gap-2"
              draggable={prefersNativeDrag}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", `column:${column.id}`)}
            >
              {renamingColumnId === column.id ? (
                <input
                  aria-label="Column name"
                  autoFocus
                  className="orbit-input min-w-0 flex-1 px-2 py-1 text-sm"
                  onBlur={() => commitRename(column.id)}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename(column.id);
                    }
                    if (event.key === "Escape") setRenamingColumnId(null);
                  }}
                  value={renameDraft}
                />
              ) : (
                <button
                  aria-label={`Rename ${column.title} column`}
                  className="min-w-0 truncate text-left text-sm font-semibold text-white hover:text-cyan-100"
                  onClick={() => {
                    setRenamingColumnId(column.id);
                    setRenameDraft(column.title);
                  }}
                  type="button"
                >
                  {column.title}
                </button>
              )}
              <span className="relative flex shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-slate-400/15 px-2 py-0.5 text-xs font-semibold text-slate-300">
                  {columnItems.length}
                </span>
                <button
                  aria-expanded={menuColumnId === column.id}
                  aria-haspopup="menu"
                  aria-label={`${column.title} column options`}
                  className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                  onClick={() => setMenuColumnId((current) => (current === column.id ? null : column.id))}
                  type="button"
                >
                  <MoreHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                {menuColumnId === column.id ? (
                  <div
                    className="surface-raised absolute right-0 top-7 z-20 grid w-36 gap-0.5 rounded-lg border border-slate-400/15 p-1"
                    role="menu"
                  >
                    <button
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-200 transition hover:bg-white/5"
                      onClick={() => {
                        setMenuColumnId(null);
                        setRenamingColumnId(column.id);
                        setRenameDraft(column.title);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      Rename column
                    </button>
                    <button
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-rose-200 transition hover:bg-rose-400/10"
                      onClick={() => {
                        setMenuColumnId(null);
                        requestDelete(column);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Delete column
                    </button>
                  </div>
                ) : null}
              </span>
            </header>

            {deleteCandidateId === column.id ? (
              <div className="grid gap-2 rounded-md border border-rose-300/25 bg-rose-300/5 p-2">
                <label className="grid gap-1 text-xs font-medium text-slate-300">
                  Move tasks to
                  <select
                    className="orbit-input px-2 py-1.5 text-xs"
                    onChange={(event) => setMoveTargetId(event.target.value)}
                    value={moveTargetId}
                  >
                    {otherColumns.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    className="orbit-button-secondary flex-1 justify-center px-2 py-1.5 text-xs"
                    onClick={() => confirmDelete(column)}
                    type="button"
                  >
                    Delete and move tasks
                  </button>
                  <button
                    className="orbit-button-secondary px-2 py-1.5 text-xs"
                    onClick={() => setDeleteCandidateId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {columnItems.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-400/20 bg-slate-950/45 px-3 py-4 text-center text-xs text-slate-400">
                Orbit clear.
              </p>
            ) : null}

            {columnItems.map((item, index) => {
              const itemLabels = meta?.labelsByItem.get(item.id) ?? [];
              const checklist = meta?.checklistByItem.get(item.id);
              const commentCount = meta?.commentCountByItem.get(item.id) ?? 0;
              const attachmentCount = meta?.attachmentCountByItem.get(item.id) ?? 0;
              const assigneeName = item.assigned_to ? assigneeNames?.get(item.assigned_to) : undefined;

              return (
              <article
                className={clsx(
                  "kanban-card orbit-task-card orbit-state-border orbit-spotlight orbit-stagger relative grid cursor-grab gap-3 rounded-md border border-slate-400/10 bg-slate-950/45 p-3",
                  draggedItemId === item.id && "kanban-drag-source",
                  recentlyUpdated.has(item.id) && "orbit-state-border--once",
                )}
                data-kanban-card
                draggable={prefersNativeDrag}
                key={item.id}
                onDragEnd={clearItemDrag}
                onDragStart={(event) => beginItemDrag(event, item.id)}
                style={{ "--stagger-index": String(staggerDelayMs(index)) } as React.CSSProperties}
                // The card is draggable and carries drag handlers but was otherwise
                // unreachable by keyboard. tabIndex makes it a real focus target so
                // the focus-visible arc (styles.css) has something to appear on.
                tabIndex={0}
              >
                {itemLabels.length > 0 ? (
                  <div aria-label="Labels" className="flex flex-wrap gap-1">
                    {itemLabels.slice(0, 6).map((label) => (
                      <span
                        className={clsx("h-1.5 w-6 rounded-full", labelBarClasses[label.color])}
                        key={label.id}
                        title={label.name}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="min-w-0">
                  {onOpenItem ? (
                    <button
                      aria-label={`Open ${item.title}`}
                      className="break-words text-left text-sm font-semibold text-white hover:text-cyan-100"
                      onClick={() => onOpenItem(item.id)}
                      type="button"
                    >
                      {item.title}
                    </button>
                  ) : (
                    <h3 className="break-words text-sm font-semibold text-white">{item.title}</h3>
                  )}
                  {item.description ? (
                    <p className="mt-1 line-clamp-3 break-words text-xs text-slate-400">{toPlainText(item.description)}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
                  {item.due_date ? <StatusPill tone="neutral">Due {formatDueDate(item.due_date)}</StatusPill> : null}
                  {item.completed_at ? <StatusPill tone="good">completed</StatusPill> : null}
                  {assigneeName && item.assigned_to ? (
                    <MemberAvatar displayName={assigneeName} size="sm" userId={item.assigned_to} />
                  ) : null}
                </div>

                {checklist?.total || commentCount || attachmentCount ? (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {checklist && checklist.total > 0 ? (
                      <span
                        aria-label={`Checklist ${checklist.done} of ${checklist.total}`}
                        className={clsx(
                          "inline-flex items-center gap-1",
                          checklist.done === checklist.total && "text-emerald-200",
                        )}
                      >
                        <CheckSquare aria-hidden="true" className="h-3.5 w-3.5" />
                        {checklist.done}/{checklist.total}
                      </span>
                    ) : null}
                    {commentCount > 0 ? (
                      <span aria-label={`${commentCount} comments`} className="inline-flex items-center gap-1">
                        <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                        {commentCount}
                      </span>
                    ) : null}
                    {attachmentCount > 0 ? (
                      <span aria-label={`${attachmentCount} attachments`} className="inline-flex items-center gap-1">
                        <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
                        {attachmentCount}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <label className="grid gap-1 text-xs font-medium text-slate-400">
                  <span className="sr-only">{`Move ${item.title} to`}</span>
                  <select
                    aria-label={`Move ${item.title} to`}
                    className="orbit-input px-2 py-1.5 text-xs"
                    disabled={isUpdating}
                    onChange={(event) => {
                      const target = columns.find((candidate) => candidate.id === event.target.value);
                      if (target) onMoveItem(item.id, target);
                    }}
                    value={column.id}
                  >
                    {columns.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
              );
            })}
          </section>
        );
      })}

      {draggedItem ? (
        <div
          aria-hidden="true"
          className="kanban-drag-preview surface-focus fixed z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg p-3"
          style={{
            left: dragPosition.x + 14,
            pointerEvents: "none",
            top: dragPosition.y + 14,
          }}
        >
          <p className="break-words text-sm font-semibold text-white">{draggedItem.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill tone={priorityTone(draggedItem.priority)}>{draggedItem.priority}</StatusPill>
            {draggedItem.due_date ? (
              <StatusPill tone="neutral">Due {formatDueDate(draggedItem.due_date)}</StatusPill>
            ) : null}
          </div>
        </div>
      ) : null}

      {showAddColumn ? (
        <div className="min-w-[12.5rem] flex-1">
          {isAddingColumn ? (
            <form className="orbit-panel-soft grid gap-2 rounded-lg p-3" onSubmit={submitNewColumn}>
              <input
                aria-label="New column name"
                autoFocus
                className="orbit-input px-2 py-1.5 text-sm"
                onChange={(event) => setNewColumnTitle(event.target.value)}
                placeholder="Column name"
                value={newColumnTitle}
              />
              <select
                aria-label="New column category"
                className="orbit-input px-2 py-1.5 text-xs"
                onChange={(event) => setNewColumnCategory(event.target.value as WorkItemStatus)}
                value={newColumnCategory}
              >
                {workItemStatuses.map((status) => (
                  <option key={status} value={status}>
                    {categoryLabels[status]}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="orbit-button-secondary flex-1 justify-center px-2 py-1.5 text-xs" type="submit">
                  Create column
                </button>
                <button
                  className="orbit-button-secondary px-2 py-1.5 text-xs"
                  onClick={() => setIsAddingColumn(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              aria-label="Add column"
              className="grid min-h-24 w-full place-items-center rounded-lg border border-dashed border-slate-400/25 text-sm font-medium text-slate-400 transition hover:border-cyan-300/40 hover:text-cyan-100"
              onClick={() => setIsAddingColumn(true)}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add column
              </span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
