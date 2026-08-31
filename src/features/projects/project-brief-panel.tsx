import { FileText } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Field } from "../../components/field";
import type { Database } from "../../lib/supabase/database.types";
import type { ProjectBriefValues } from "./project-brief.queries";

type ProjectBrief = Database["public"]["Tables"]["project_briefs"]["Row"];

function valuesFromBrief(brief: ProjectBrief | null): ProjectBriefValues {
  return {
    goal: brief?.goal ?? "",
    audience: brief?.audience ?? "",
    successCriteria: brief?.success_criteria ?? "",
    constraints: brief?.constraints ?? "",
    statusSummary: brief?.status_summary ?? "",
    nextMilestone: brief?.next_milestone ?? "",
  };
}

export function ProjectBriefPanel({
  brief,
  isLoading = false,
  isSaving = false,
  linksSlot,
  onSave,
}: {
  brief: ProjectBrief | null;
  isLoading?: boolean;
  isSaving?: boolean;
  // A slot keeps this panel presentational — it stays ignorant of link queries.
  linksSlot?: ReactNode;
  onSave: (values: ProjectBriefValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<ProjectBriefValues>(() => valuesFromBrief(brief));
  const isDirty = useRef(false);
  const isDisabled = isLoading || isSaving;

  useEffect(() => {
    if (!isDirty.current) {
      setValues(valuesFromBrief(brief));
    }
  }, [brief]);

  function updateValue(field: keyof ProjectBriefValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    isDirty.current = true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextValues = {
      ...values,
      goal: values.goal.trim(),
      audience: values.audience.trim(),
      successCriteria: values.successCriteria.trim(),
      constraints: values.constraints.trim(),
      statusSummary: values.statusSummary.trim(),
      nextMilestone: values.nextMilestone.trim(),
    };

    setValues(nextValues);
    try {
      await onSave(nextValues);
      isDirty.current = false;
    } catch {
      // The workspace owns rendering save failures; keep the current draft dirty.
    }
  }

  const digest = values.goal.trim() ? values.goal.trim() : "Add a goal, audience, and success criteria.";
  const milestone = values.nextMilestone.trim();

  return (
    <details className="surface-whisper rounded-xl p-4">
      <summary className="flex cursor-pointer items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <FileText size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">Project brief</span>
          <span className="mt-0.5 block truncate text-sm text-slate-400">{digest}</span>
          {milestone ? (
            <span className="mt-0.5 block truncate text-xs text-slate-500">Next milestone: {milestone}</span>
          ) : null}
        </span>
      </summary>

      <form className="mt-4 grid gap-4 border-t border-slate-400/10 pt-4" onSubmit={handleSubmit}>
        <Field label="Project goal">
          <textarea
            className="orbit-input min-h-20"
            disabled={isDisabled}
            onChange={(event) => updateValue("goal", event.target.value)}
            value={values.goal}
          />
        </Field>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Audience">
            <textarea
              className="orbit-input min-h-20"
              disabled={isDisabled}
              onChange={(event) => updateValue("audience", event.target.value)}
              value={values.audience}
            />
          </Field>

          <Field label="Success criteria">
            <textarea
              className="orbit-input min-h-20"
              disabled={isDisabled}
              onChange={(event) => updateValue("successCriteria", event.target.value)}
              value={values.successCriteria}
            />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Constraints">
            <textarea
              className="orbit-input min-h-20"
              disabled={isDisabled}
              onChange={(event) => updateValue("constraints", event.target.value)}
              value={values.constraints}
            />
          </Field>

          <Field label="Status summary">
            <textarea
              className="orbit-input min-h-20"
              disabled={isDisabled}
              onChange={(event) => updateValue("statusSummary", event.target.value)}
              value={values.statusSummary}
            />
          </Field>

          <Field label="Next milestone">
            <textarea
              className="orbit-input min-h-20"
              disabled={isDisabled}
              onChange={(event) => updateValue("nextMilestone", event.target.value)}
              value={values.nextMilestone}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <button className="orbit-button" disabled={isDisabled} type="submit">
            Save project brief
          </button>
        </div>
      </form>

      {linksSlot ? (
        <div className="mt-4 border-t border-slate-400/10 pt-4">{linksSlot}</div>
      ) : null}
    </details>
  );
}
