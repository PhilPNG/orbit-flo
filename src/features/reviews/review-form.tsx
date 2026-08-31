import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { ProjectHealth } from "../../lib/supabase/database.types";

const healthValues = ["good", "watch", "at_risk", "blocked"] as const;

export interface ReviewFormValues {
  weekStart: string;
  wins: string;
  blockers: string;
  nextFocus: string;
  health?: ProjectHealth;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function currentWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - distanceFromMonday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const monthDay = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${monthDay}`;
}

export function ReviewForm({
  isSubmitting = false,
  onSubmit,
}: {
  isSubmitting?: boolean;
  onSubmit: (values: ReviewFormValues) => void;
}) {
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [wins, setWins] = useState("");
  const [blockers, setBlockers] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [health, setHealth] = useState<ProjectHealth | "">("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!weekStart) return;

    onSubmit({
      weekStart,
      wins: wins.trim(),
      blockers: blockers.trim(),
      nextFocus: nextFocus.trim(),
      health: health || undefined,
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Week start">
          <input
            className="orbit-input"
            disabled={isSubmitting}
            onChange={(event) => setWeekStart(event.target.value)}
            required
            type="date"
            value={weekStart}
          />
        </Field>

        <Field label="Health">
          <select
            className="orbit-input"
            disabled={isSubmitting}
            onChange={(event) => setHealth(event.target.value as ProjectHealth | "")}
            value={health}
          >
            <option value="">No health rating</option>
            {healthValues.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Wins">
        <textarea
          className="orbit-input min-h-20"
          disabled={isSubmitting}
          onChange={(event) => setWins(event.target.value)}
          value={wins}
        />
      </Field>

      <Field label="Blockers">
        <textarea
          className="orbit-input min-h-20"
          disabled={isSubmitting}
          onChange={(event) => setBlockers(event.target.value)}
          value={blockers}
        />
      </Field>

      <Field label="Next focus">
        <textarea
          className="orbit-input min-h-20"
          disabled={isSubmitting}
          onChange={(event) => setNextFocus(event.target.value)}
          value={nextFocus}
        />
      </Field>

      <div className="flex justify-end">
        <button
          className="orbit-button"
          disabled={isSubmitting || !weekStart}
          type="submit"
        >
          {isSubmitting ? "Logging..." : "Log review"}
        </button>
      </div>
    </form>
  );
}
