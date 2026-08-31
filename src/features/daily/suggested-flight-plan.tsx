import { Plus } from "lucide-react";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import type { Database } from "../../lib/supabase/database.types";
import { formatPlannedChip, getSuggestedDailyWorkItems } from "./daily-plan.utils";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function priorityTone(priority: WorkItem["priority"]): StatusTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "good";
  return "neutral";
}

function suggestionReasons(item: WorkItem, todayKey: string) {
  const reasons: string[] = [];

  if (item.due_date && item.due_date < todayKey) reasons.push("Overdue");
  if (item.due_date === todayKey) reasons.push("Due today");
  if (item.priority === "critical") reasons.push("Critical priority");
  if (item.priority === "high") reasons.push("High priority");
  if (item.blocked_reason) reasons.push("Needs unblock");

  return reasons.length > 0 ? reasons : ["Ready to move"];
}

function projectLabel(item: WorkItem, projectNamesById: Record<string, string>) {
  if (!item.project_id) return "Unassigned";
  return projectNamesById[item.project_id] ?? `Project ${item.project_id.slice(0, 8)}`;
}

export function SuggestedFlightPlan({
  availableWorkItems,
  dailyPlanItems,
  isAdding,
  onAdd,
  projectNamesById = {},
  todayKey,
}: {
  availableWorkItems: WorkItem[];
  dailyPlanItems: DailyPlanItemWithWorkItem[];
  isAdding: boolean;
  onAdd: (workItem: WorkItem, index: number) => void;
  projectNamesById?: Record<string, string>;
  todayKey: string;
}) {
  const suggestions = getSuggestedDailyWorkItems(availableWorkItems, dailyPlanItems, todayKey);

  if (suggestions.length === 0) return null;

  return (
    <ul aria-label="Suggested for today" className="today-suggestion-list overflow-hidden rounded-xl">
      {suggestions.map((item, index) => {
        const reasons = suggestionReasons(item, todayKey);
        const plannedChip = formatPlannedChip(item.planned_at, item.planned_minutes);

        return (
          <li
            className="today-suggestion-row flex min-h-14 items-center justify-between gap-3 px-3 py-2"
            draggable
            key={item.id}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{item.title}</p>
              <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-slate-400">
                <span className="shrink-0">{projectLabel(item, projectNamesById)}</span>
                <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
                {plannedChip ? <span className="shrink-0 text-cyan-100">{plannedChip}</span> : null}
                {item.due_date ? <span className="shrink-0">Due {item.due_date}</span> : null}
                <span className="sr-only">Why this?</span>
                {reasons.map((reason) => (
                  <span
                    className={reason.endsWith("priority") ? "sr-only" : "shrink-0 truncate"}
                    key={reason}
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
            <button
              aria-label={`Add ${item.title} to today`}
              className="orbit-button-secondary grid h-9 w-9 shrink-0 place-items-center p-0"
              disabled={isAdding}
              onClick={() => onAdd(item, index)}
              type="button"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
