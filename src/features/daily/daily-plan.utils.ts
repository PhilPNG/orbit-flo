import type { Database } from "../../lib/supabase/database.types";

type DailyPlanItem = Database["public"]["Tables"]["daily_plan_items"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export function formatPlanDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function sortDailyPlanItems<T extends Pick<DailyPlanItem, "sort_order" | "created_at">>(items: T[]) {
  return [...items].sort((a, b) => {
    const sortDelta = a.sort_order - b.sort_order;
    if (sortDelta !== 0) return sortDelta;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function getPrimaryDailyItem<T extends Pick<DailyPlanItem, "is_primary" | "state" | "sort_order" | "created_at">>(
  items: T[],
) {
  const sorted = sortDailyPlanItems(items);
  return sorted.find((item) => item.is_primary) ?? sorted.find((item) => item.state === "planned") ?? sorted[0];
}

export function calculateDailyPlanSummary(items: Pick<DailyPlanItem, "state">[]) {
  const completed = items.filter((item) => item.state === "completed").length;
  const skipped = items.filter((item) => item.state === "skipped").length;
  const planned = items.filter((item) => item.state === "planned").length;
  const total = items.length;

  return {
    total,
    completed,
    skipped,
    planned,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function buildTodayGreeting(items: Pick<DailyPlanItem, "state">[], suggestedCount = 0) {
  const summary = calculateDailyPlanSummary(items);

  if (summary.total === 0) {
    if (suggestedCount > 0) {
      return `A clear sky. ${suggestedCount} suggestion${suggestedCount === 1 ? "" : "s"} waiting when you're ready.`;
    }
    return "A clear sky. Add an objective to begin.";
  }

  const parts = [`${summary.total} objective${summary.total === 1 ? "" : "s"} in orbit`];
  if (summary.completed > 0) parts.push(`${summary.completed} complete`);
  if (suggestedCount > 0) parts.push(`${suggestedCount} suggestion${suggestedCount === 1 ? "" : "s"} waiting`);

  return parts.join(" · ");
}

const priorityRank = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function dueDateRank(dueDate: string | null, todayKey: string) {
  if (!dueDate) return 3;
  if (dueDate < todayKey) return 0;
  if (dueDate === todayKey) return 1;
  return 3;
}

export function getSuggestedDailyWorkItems(
  availableWorkItems: WorkItem[],
  dailyPlanItems: Pick<DailyPlanItem, "work_item_id">[],
  todayKey = formatPlanDate(),
) {
  const plannedWorkItemIds = new Set(dailyPlanItems.map((item) => item.work_item_id));

  return availableWorkItems
    .filter((item) => !plannedWorkItemIds.has(item.id))
    .sort((a, b) => {
      const dueDelta = dueDateRank(a.due_date, todayKey) - dueDateRank(b.due_date, todayKey);
      if (dueDelta !== 0) return dueDelta;

      const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
      if (priorityDelta !== 0) return priorityDelta;

      return b.updated_at.localeCompare(a.updated_at);
    })
    .slice(0, 5);
}

export function formatPlannedChip(plannedAt: string | null, plannedMinutes: number | null): string | null {
  const parts: string[] = [];

  if (plannedAt) {
    const [hours, minutes] = plannedAt.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    parts.push(`${hour12}:${String(minutes).padStart(2, "0")} ${period}`);
  }

  if (plannedMinutes) parts.push(`${plannedMinutes}m`);

  return parts.length > 0 ? parts.join(" \u00b7 ") : null;
}
