export interface RecurrenceRule {
  id: string;
  pattern: "daily" | "weekdays" | "weekly" | "monthly";
  weekdays: number[];
  dayOfMonth: number | null;
}

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dates are handled in UTC so a local timezone can never shift which day a
// YYYY-MM-DD key lands on.
function toDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function toKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function matchesRecurrence(rule: RecurrenceRule, dateKey: string): boolean {
  const date = toDate(dateKey);
  const weekday = date.getUTCDay();

  if (rule.pattern === "daily") return true;
  if (rule.pattern === "weekdays") return weekday >= 1 && weekday <= 5;
  if (rule.pattern === "weekly") return rule.weekdays.includes(weekday);

  if (rule.dayOfMonth === null) return false;

  // A rule set past the end of a short month fires on its last day, otherwise
  // "the 31st" would silently never happen in February.
  const target = Math.min(rule.dayOfMonth, lastDayOfMonth(date));
  return date.getUTCDate() === target;
}

export function countMissedOccurrences(
  rule: RecurrenceRule,
  afterKey: string | null,
  throughKey: string,
): number {
  if (!afterKey) return 0;

  let count = 0;
  const cursor = toDate(afterKey);
  const end = toDate(throughKey);

  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor < end) {
    if (matchesRecurrence(rule, toKey(cursor))) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.pattern === "daily") return "Every day";
  if (rule.pattern === "weekdays") return "Every weekday";

  if (rule.pattern === "weekly") {
    const days = [...rule.weekdays].sort((a, b) => a - b).map((day) => weekdayNames[day]);
    return `Weekly on ${days.join(", ")}`;
  }

  return `Monthly on day ${rule.dayOfMonth}`;
}
