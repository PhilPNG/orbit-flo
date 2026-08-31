import { Check, Edit3, ListChecks, X } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import type { Database, ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";
import { toPlainText } from "../links/plain-text";
import { workItemStatuses } from "./work-items.queries";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];
type SavedView = "all" | "overdue-critical" | "quick-wins" | "waiting" | "deep-work";

function priorityTone(priority: ProjectPriority): StatusTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "good";
  return "neutral";
}

function formatStatus(status: WorkItemStatus) {
  return status.replaceAll("_", " ");
}

function taskAgeDays(createdAt: string, todayKey: string) {
  const createdDate = new Date(createdAt);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  return Math.max(0, Math.floor((todayDate.getTime() - createdDate.getTime()) / 86_400_000));
}

export function TaskListView({
  isUpdating = false,
  items,
  onOpenItem,
  onInlineUpdate,
  onStatusChange,
  todayKey = new Date().toISOString().slice(0, 10),
}: {
  isUpdating?: boolean;
  items: WorkItem[];
  onOpenItem?: (id: string) => void;
  onInlineUpdate?: (id: string, values: { title: string }) => void;
  onStatusChange?: (id: string, status: WorkItemStatus) => void;
  todayKey?: string;
}) {
  const [savedView, setSavedView] = useState<SavedView>("all");
  const [peekedItemId, setPeekedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const filteredItems = items.filter((item) => {
    if (savedView === "overdue-critical") {
      return item.priority === "critical" && item.due_date !== null && item.due_date < todayKey && item.status !== "done";
    }
    if (savedView === "quick-wins") {
      return item.priority === "low" && item.status !== "done";
    }
    if (savedView === "waiting") {
      return item.status === "blocked" || Boolean(item.blocked_reason);
    }
    if (savedView === "deep-work") {
      return (item.priority === "high" || item.priority === "critical") && item.status !== "done";
    }
    return true;
  });

  function startInlineEdit(item: WorkItem) {
    setEditingItemId(item.id);
    setInlineTitle(item.title);
  }

  function saveInlineEdit(item: WorkItem) {
    const trimmedTitle = inlineTitle.trim();
    if (!trimmedTitle || trimmedTitle === item.title) {
      setEditingItemId(null);
      return;
    }

    onInlineUpdate?.(item.id, { title: trimmedTitle });
    setEditingItemId(null);
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No tasks launched"
        message="Create a task to start filling the list view."
      />
    );
  }

  return (
    <section className="orbit-panel rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <ListChecks size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="mission-label">Dense scan</p>
          <h2 className="text-xl font-black text-white">Task List</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
        <p className="text-sm leading-6 text-slate-400">
          Use saved views to cut straight to overdue, blocked, quick-win, or deep-work tasks.
        </p>
        <label className="grid gap-1 text-xs font-medium text-slate-400">
          Saved view
          <select
            className="orbit-input px-2 py-1.5 text-xs"
            onChange={(event) => setSavedView(event.target.value as SavedView)}
            value={savedView}
          >
            <option value="all">All tasks</option>
            <option value="overdue-critical">Overdue critical</option>
            <option value="quick-wins">Quick wins</option>
            <option value="waiting">Waiting on me</option>
            <option value="deep-work">Deep work</option>
          </select>
        </label>
      </div>

      <ul className="mt-5 grid gap-3">
        {filteredItems.map((item) => (
          <li
            className="orbit-panel-soft rounded-lg p-3"
            key={item.id}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setPeekedItemId(null);
            }}
            onFocus={() => setPeekedItemId(item.id)}
            onMouseEnter={() => setPeekedItemId(item.id)}
            onMouseLeave={() => setPeekedItemId(null)}
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                {editingItemId === item.id ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="sr-only" htmlFor={`inline-title-${item.id}`}>
                      Inline title for {item.title}
                    </label>
                    <input
                      className="orbit-input px-2 py-1.5 text-sm"
                      disabled={isUpdating}
                      id={`inline-title-${item.id}`}
                      onChange={(event) => setInlineTitle(event.target.value)}
                      value={inlineTitle}
                    />
                    <button
                      aria-label={`Save inline edit for ${item.title}`}
                      className="orbit-button-secondary grid h-9 w-9 place-items-center p-0"
                      disabled={isUpdating}
                      onClick={() => saveInlineEdit(item)}
                      type="button"
                    >
                      <Check aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      aria-label={`Cancel inline edit for ${item.title}`}
                      className="orbit-button-secondary grid h-9 w-9 place-items-center p-0"
                      disabled={isUpdating}
                      onClick={() => setEditingItemId(null)}
                      type="button"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                ) : onOpenItem ? (
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
                {item.description && peekedItemId !== item.id ? (
                  <p className="mt-1 line-clamp-2 break-words text-xs text-slate-400">{toPlainText(item.description)}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
                  <StatusPill>{formatStatus(item.status)}</StatusPill>
                  {item.due_date ? <StatusPill>Due {item.due_date}</StatusPill> : null}
                  {taskAgeDays(item.created_at, todayKey) >= 14 ? (
                    <StatusPill tone="warning">Aging {taskAgeDays(item.created_at, todayKey)}d</StatusPill>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {onInlineUpdate ? (
                    <button
                      aria-label={`Quick edit ${item.title}`}
                      className="orbit-button-secondary px-2 py-1 text-xs"
                      disabled={isUpdating}
                      onClick={() => startInlineEdit(item)}
                      type="button"
                    >
                      <Edit3 aria-hidden="true" className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  ) : null}
                </div>
                {peekedItemId === item.id ? (
                  <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3">
                    <p className="text-xs font-bold uppercase text-cyan-100">Quick preview</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {toPlainText(item.description ?? "") || "No description yet."}
                    </p>
                    {item.blocked_reason ? (
                      <p className="mt-2 rounded-md border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-xs font-semibold text-rose-100">
                        {item.blocked_reason}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {onStatusChange ? (
                <label className="grid gap-1 text-xs font-medium text-slate-400">
                  Move to
                  <select
                    className="orbit-input min-w-40 px-2 py-1.5 text-xs"
                    disabled={isUpdating}
                    onChange={(event) => onStatusChange(item.id, event.target.value as WorkItemStatus)}
                    value={item.status}
                  >
                    {workItemStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {filteredItems.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-slate-400/20 px-4 py-6 text-center text-sm text-slate-400">
          No tasks match this saved view.
        </p>
      ) : null}
    </section>
  );
}
