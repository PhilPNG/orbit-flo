import { formatPlanDate } from "../daily/daily-plan.utils";

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const dashboardDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDashboardDate(value: string | null): string {
  if (!value) return "No date";

  if (dateOnlyPattern.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dashboardDateFormatter.format(new Date(year, month - 1, day));
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "No date";
  return dashboardDateFormatter.format(date);
}

export function getDashboardTodayKey(date = new Date()) {
  return formatPlanDate(date);
}
