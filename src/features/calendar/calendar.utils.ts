import type { Database } from "../../lib/supabase/database.types";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export type DeadlineTone = "overdue" | "today" | "upcoming" | "none";

export interface CalendarDay {
  date: Date;
  dateKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addUtcDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function buildCalendarWeeks(viewDate: Date, today = new Date()) {
  const monthStart = new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), 1));
  const gridStart = addUtcDays(monthStart, -monthStart.getUTCDay());
  const todayKey = toDateKey(today);

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addUtcDays(gridStart, weekIndex * 7 + dayIndex);
      const dateKey = toDateKey(date);

      return {
        date,
        dateKey,
        dayOfMonth: date.getUTCDate(),
        isCurrentMonth: date.getUTCMonth() === monthStart.getUTCMonth(),
        isToday: dateKey === todayKey,
      };
    }),
  );
}

export function getCalendarRange(viewDate: Date) {
  const weeks = buildCalendarWeeks(viewDate);
  const firstDay = weeks[0][0];
  const lastWeek = weeks[weeks.length - 1];
  const lastDay = lastWeek[lastWeek.length - 1];

  return {
    startDate: firstDay.dateKey,
    endDate: lastDay.dateKey,
  };
}

export function getMonthTitle(viewDate: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(viewDate);
}

export function groupWorkItemsByDueDate(items: WorkItem[]) {
  return items.reduce<Map<string, WorkItem[]>>((grouped, item) => {
    if (!item.due_date) return grouped;

    const currentItems = grouped.get(item.due_date) ?? [];
    grouped.set(item.due_date, [...currentItems, item]);
    return grouped;
  }, new Map());
}

export function getDueDateStats(items: WorkItem[], todayKey = toDateKey(new Date())) {
  return items.reduce(
    (stats, item) => {
      if (!item.due_date || item.status === "done") return stats;

      if (item.due_date < todayKey) {
        stats.overdue += 1;
      } else if (item.due_date === todayKey) {
        stats.dueToday += 1;
      } else {
        stats.upcoming += 1;
      }

      return stats;
    },
    {
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
    },
  );
}

export function getDeadlineTone(dueDate: string | null, todayKey = toDateKey(new Date())): DeadlineTone {
  if (!dueDate) return "none";
  if (dueDate < todayKey) return "overdue";
  if (dueDate === todayKey) return "today";
  return "upcoming";
}

function daysBetween(dateKey: string, todayKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const today = new Date(`${todayKey}T00:00:00Z`);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

export function getDeadlineBuckets(items: WorkItem[], todayKey = toDateKey(new Date())) {
  return items.reduce(
    (buckets, item) => {
      if (!item.due_date || item.status === "done") return buckets;

      const tone = getDeadlineTone(item.due_date, todayKey);

      if (tone === "overdue") {
        buckets.overdue.push(item);
        return buckets;
      }

      if (tone === "today") {
        buckets.today.push(item);
        return buckets;
      }

      if (daysBetween(item.due_date, todayKey) <= 7) {
        buckets.thisWeek.push(item);
      } else {
        buckets.later.push(item);
      }

      return buckets;
    },
    {
      overdue: [] as WorkItem[],
      today: [] as WorkItem[],
      thisWeek: [] as WorkItem[],
      later: [] as WorkItem[],
    },
  );
}
