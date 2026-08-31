import { ClipboardCheck, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { Database } from "../../lib/supabase/database.types";
import type { LaunchChecklistItem, LaunchChecklistValues } from "./launch-checklist.queries";

type LaunchChecklist = Database["public"]["Tables"]["launch_checklists"]["Row"];

export const defaultLaunchChecklistItems = [
  { id: "tests", label: "Tests pass", isDone: false },
  { id: "docs", label: "Documentation updated", isDone: false },
  { id: "review", label: "Review completed", isDone: false },
  { id: "deploy", label: "Deployment path confirmed", isDone: false },
  { id: "rollback", label: "Rollback plan captured", isDone: false },
  { id: "proof", label: "Screenshots or proof captured", isDone: false },
  { id: "follow-up", label: "Follow-up tasks created", isDone: false },
] satisfies LaunchChecklistItem[];

function isChecklistItem(value: unknown): value is LaunchChecklistItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LaunchChecklistItem>;
  return typeof item.id === "string" && typeof item.label === "string" && typeof item.isDone === "boolean";
}

function itemsFromChecklist(checklist: LaunchChecklist | null): LaunchChecklistItem[] {
  if (Array.isArray(checklist?.checklist_items)) {
    const existingItems = checklist.checklist_items.filter(isChecklistItem);
    if (existingItems.length > 0) return existingItems;
  }

  return defaultLaunchChecklistItems.map((item) => ({ ...item }));
}

function valuesFromChecklist(checklist: LaunchChecklist | null): LaunchChecklistValues {
  return {
    title: checklist?.title || "Launch checklist",
    milestoneId: checklist?.milestone_id ?? null,
    completedAt: checklist?.completed_at ?? null,
    checklistItems: itemsFromChecklist(checklist),
  };
}

function createCustomItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `custom-${Date.now()}`;
}

export function LaunchChecklistPanel({
  checklist,
  isLoading = false,
  isSaving = false,
  onSave,
}: {
  checklist: LaunchChecklist | null;
  isLoading?: boolean;
  isSaving?: boolean;
  onSave: (values: LaunchChecklistValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<LaunchChecklistValues>(() => valuesFromChecklist(checklist));
  const [customLabel, setCustomLabel] = useState("");
  const isDirty = useRef(false);
  const isDisabled = isLoading || isSaving;
  const trimmedCustomLabel = customLabel.trim();

  useEffect(() => {
    if (!isDirty.current) {
      setValues(valuesFromChecklist(checklist));
    }
  }, [checklist]);

  function toggleItem(id: string) {
    setValues((current) => ({
      ...current,
      checklistItems: current.checklistItems.map((item) => (item.id === id ? { ...item, isDone: !item.isDone } : item)),
    }));
    isDirty.current = true;
  }

  function addCustomItem() {
    if (!trimmedCustomLabel) return;

    setValues((current) => ({
      ...current,
      checklistItems: [
        ...current.checklistItems,
        {
          id: createCustomItemId(),
          label: trimmedCustomLabel,
          isDone: false,
        },
      ],
    }));
    setCustomLabel("");
    isDirty.current = true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const allItemsDone = values.checklistItems.length > 0 && values.checklistItems.every((item) => item.isDone);
    const nextValues = {
      ...values,
      title: values.title.trim() || "Launch checklist",
      completedAt: allItemsDone ? values.completedAt ?? new Date().toISOString() : null,
    };

    setValues(nextValues);
    try {
      await onSave(nextValues);
      isDirty.current = false;
    } catch {
      // The workspace renders save failures; keep the current checklist draft available.
    }
  }

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
          <ClipboardCheck size={17} aria-hidden="true" />
        </span>
        <div>
          <p className="mission-label">Release readiness</p>
          <h2 className="mt-1 text-lg font-black text-white">Launch checklist</h2>
        </div>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-2">
          {values.checklistItems.map((item) => (
            <label
              className="flex items-center gap-3 rounded-md border border-slate-400/15 bg-slate-950/30 px-3 py-2 text-sm font-semibold text-slate-100"
              key={item.id}
            >
              <input
                checked={item.isDone}
                className="h-4 w-4 accent-cyan-300"
                disabled={isDisabled}
                onChange={() => toggleItem(item.id)}
                type="checkbox"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Custom launch item">
            <input
              className="orbit-input"
              disabled={isDisabled}
              onChange={(event) => setCustomLabel(event.target.value)}
              value={customLabel}
            />
          </Field>
          <button
            className="orbit-button-secondary"
            disabled={isDisabled || !trimmedCustomLabel}
            onClick={addCustomItem}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            Add launch item
          </button>
        </div>

        <div className="flex justify-end">
          <button className="orbit-button" disabled={isDisabled} type="submit">
            Save launch checklist
          </button>
        </div>
      </form>
    </section>
  );
}
