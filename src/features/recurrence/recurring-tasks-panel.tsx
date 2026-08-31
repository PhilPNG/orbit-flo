import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, Repeat, Trash2, X } from "lucide-react";
import { useState } from "react";
import { InlineAlert } from "../../components/inline-alert";
import { supabase } from "../../lib/supabase/client";
import type { RecurrencePattern } from "../../lib/supabase/database.types";
import {
  createRecurrenceRule,
  deleteRecurrenceRule,
  listRecurrenceRules,
  recurrenceKeys,
  updateRecurrenceRule,
} from "./recurrence.queries";
import { describeRecurrence } from "./recurrence.utils";

const patternOptions: Array<{ value: RecurrencePattern; label: string }> = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RecurringTasksPanel({
  workspaceId,
  projectId,
  userId,
  onHide,
}: {
  workspaceId: string;
  projectId: string;
  userId: string;
  onHide: () => void;
}) {
  const queryClient = useQueryClient();
  const listKey = recurrenceKeys.project(workspaceId, projectId);

  const [title, setTitle] = useState("");
  const [pattern, setPattern] = useState<RecurrencePattern>("daily");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [dayOfMonth, setDayOfMonth] = useState(1);

  const rulesQuery = useQuery({
    queryKey: listKey,
    queryFn: () => listRecurrenceRules(supabase, workspaceId, projectId),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: listKey });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createRecurrenceRule(supabase, {
        workspaceId,
        projectId,
        userId,
        title: title.trim(),
        priority: "medium",
        pattern,
        weekdays: pattern === "weekly" ? weekdays : [],
        dayOfMonth: pattern === "monthly" ? dayOfMonth : null,
      }),
    onSuccess: async () => {
      setTitle("");
      await refresh();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      updateRecurrenceRule(supabase, { id: input.id, workspaceId, isActive: input.isActive }),
    onSuccess: refresh,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecurrenceRule(supabase, { id, workspaceId }),
    onSuccess: refresh,
  });

  const rules = rulesQuery.data ?? [];
  const canSubmit = title.trim().length > 0 && (pattern !== "weekly" || weekdays.length > 0);

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day].sort((a, b) => a - b),
    );
  }

  return (
    <div className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
            <Repeat aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="mission-label">On a schedule</p>
            <h2 className="text-base font-black text-white">Recurring tasks</h2>
          </div>
        </div>
        <button
          aria-label="Hide recurring tasks"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          onClick={onHide}
          type="button"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>

      {rulesQuery.isError ? (
        <InlineAlert tone="error">{(rulesQuery.error as Error).message}</InlineAlert>
      ) : null}

      {rules.length === 0 && !rulesQuery.isPending ? (
        <p className="mt-4 text-sm text-slate-400">
          Nothing repeats yet. Add a rule and its task appears each morning it is due.
        </p>
      ) : null}

      <ul className="mt-4 grid gap-2">
        {rules.map((rule) => (
          <li
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-400/15 bg-slate-950/35 p-3"
            key={rule.id}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{rule.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {describeRecurrence({
                  id: rule.id,
                  pattern: rule.pattern,
                  weekdays: rule.weekdays ?? [],
                  dayOfMonth: rule.day_of_month,
                })}
                {rule.is_active ? "" : " · Paused"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                aria-label={`${rule.is_active ? "Pause" : "Resume"} ${rule.title}`}
                className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.is_active })}
                type="button"
              >
                {rule.is_active ? (
                  <Pause aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <Play aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                aria-label={`Delete ${rule.title}`}
                className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-200"
                onClick={() => deleteMutation.mutate(rule.id)}
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 border-t border-slate-400/12 pt-4">
        <label className="grid gap-1 text-xs font-medium text-slate-300">
          Recurring task title
          <input
            aria-label="Recurring task title"
            className="orbit-input px-2.5 py-1.5 text-sm"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Daily standup"
            value={title}
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-slate-300">
          Repeats
          <select
            aria-label="Recurrence pattern"
            className="orbit-input px-2.5 py-1.5 text-sm"
            onChange={(event) => setPattern(event.target.value as RecurrencePattern)}
            value={pattern}
          >
            {patternOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {pattern === "weekly" ? (
          <div aria-label="Weekdays" className="flex flex-wrap gap-1.5">
            {weekdayLabels.map((label, day) => (
              <button
                aria-pressed={weekdays.includes(day)}
                className={
                  weekdays.includes(day)
                    ? "rounded-md bg-cyan-300/15 px-2 py-1 text-xs font-semibold text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.34)]"
                    : "rounded-md border border-slate-400/20 px-2 py-1 text-xs font-semibold text-slate-400 hover:text-slate-100"
                }
                key={label}
                onClick={() => toggleWeekday(day)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {pattern === "monthly" ? (
          <label className="grid gap-1 text-xs font-medium text-slate-300">
            Day of month
            <input
              aria-label="Day of month"
              className="orbit-input px-2.5 py-1.5 text-sm"
              max={31}
              min={1}
              onChange={(event) => setDayOfMonth(Number(event.target.value))}
              type="number"
              value={dayOfMonth}
            />
          </label>
        ) : null}

        {createMutation.isError ? (
          <InlineAlert tone="error">{(createMutation.error as Error).message}</InlineAlert>
        ) : null}

        <button
          className="orbit-button-secondary justify-center px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSubmit || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          type="button"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add recurring task
        </button>
      </div>
    </div>
  );
}
