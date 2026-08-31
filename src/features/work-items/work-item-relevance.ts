import type { Database } from "../../lib/supabase/database.types";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

const relevantStatuses = new Set<WorkItem["status"]>(["blocked", "in_progress", "review"]);
const relevantPriorities = new Set<WorkItem["priority"]>(["critical", "high"]);

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function isRelevantWorkItem(item: WorkItem, todayKey: string): boolean {
  if (item.status === "done") {
    return false;
  }

  if (relevantStatuses.has(item.status) || relevantPriorities.has(item.priority) || Boolean(item.blocked_reason)) {
    return true;
  }

  if (!item.due_date) {
    return false;
  }

  return item.due_date <= addDaysToDateKey(todayKey, 7);
}

export function groupWorkItemsByRelevance(
  items: WorkItem[],
  todayKey: string,
): { relevant: WorkItem[]; later: WorkItem[] } {
  return items.reduce(
    (grouped, item) => {
      if (isRelevantWorkItem(item, todayKey)) {
        grouped.relevant.push(item);
      } else {
        grouped.later.push(item);
      }

      return grouped;
    },
    { relevant: [], later: [] } as { relevant: WorkItem[]; later: WorkItem[] },
  );
}
