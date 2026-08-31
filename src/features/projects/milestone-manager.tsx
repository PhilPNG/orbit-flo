import { CheckCircle2, Plus, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import { Modal } from "../../components/modal";
import { StatusPill } from "../../components/status-pill";
import type { Database } from "../../lib/supabase/database.types";
import { toPlainText } from "../links/plain-text";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];

export interface MilestoneFormValues {
  title: string;
  description: string;
  targetDate: string;
}

export interface MilestoneUpdateValues extends MilestoneFormValues {
  completedAt: string | null;
  sortOrder: number;
}

function MilestoneForm({
  initialMilestone,
  isSubmitting,
  onSubmit,
}: {
  initialMilestone?: Milestone;
  isSubmitting?: boolean;
  onSubmit: (values: MilestoneFormValues) => void;
}) {
  const [title, setTitle] = useState(initialMilestone?.title ?? "");
  const [description, setDescription] = useState(initialMilestone?.description ?? "");
  const [targetDate, setTargetDate] = useState(initialMilestone?.target_date ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    onSubmit({
      title: trimmedTitle,
      description: description.trim(),
      targetDate,
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <Field label="Title">
        <input
          autoFocus
          className="orbit-input"
          disabled={isSubmitting}
          onChange={(event) => setTitle(event.target.value)}
          required
          type="text"
          value={title}
        />
      </Field>

      <Field label="Description">
        <textarea
          className="orbit-input min-h-20"
          disabled={isSubmitting}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </Field>

      <Field label="Target date">
        <input
          className="orbit-input"
          disabled={isSubmitting}
          onChange={(event) => setTargetDate(event.target.value)}
          type="date"
          value={targetDate}
        />
      </Field>

      <div className="flex justify-end">
        <button className="orbit-button" disabled={isSubmitting || !title.trim()} type="submit">
          {isSubmitting ? "Saving..." : "Save milestone"}
        </button>
      </div>
    </form>
  );
}

function valuesFromMilestone(milestone: Milestone, completedAt: string | null): MilestoneUpdateValues {
  return {
    title: milestone.title,
    description: milestone.description ?? "",
    targetDate: milestone.target_date ?? "",
    completedAt,
    sortOrder: milestone.sort_order,
  };
}

export function MilestoneManager({
  isSubmitting = false,
  milestones,
  onCreate,
  onUpdate,
}: {
  isSubmitting?: boolean;
  milestones: Milestone[];
  onCreate: (values: MilestoneFormValues) => void;
  onUpdate: (id: string, values: MilestoneUpdateValues) => void;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mission-label">Milestone control</p>
          <h2 className="mt-1 text-lg font-black text-white">Milestones</h2>
        </div>
        <button className="orbit-button" onClick={() => setIsCreateOpen(true)} type="button">
          <Plus size={16} aria-hidden="true" />
          Add milestone
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {milestones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-400/20 bg-slate-950/42 px-3 py-4 text-sm text-slate-400">
            No milestones yet.
          </p>
        ) : null}

        {milestones.map((milestone) => {
          const isComplete = Boolean(milestone.completed_at);

          return (
            <article className="rounded-lg border border-slate-400/15 bg-slate-950/42 p-3" key={milestone.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-sm font-semibold text-white">{milestone.title}</h3>
                    <StatusPill tone={isComplete ? "good" : "neutral"}>{isComplete ? "complete" : "planned"}</StatusPill>
                    {milestone.target_date ? <StatusPill>Target {milestone.target_date}</StatusPill> : null}
                  </div>
                  {milestone.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                      {toPlainText(milestone.description, { preserveLineBreaks: true })}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    className="orbit-button-secondary px-3 py-1.5 text-xs"
                    onClick={() => setEditingMilestone(milestone)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    aria-label={`${isComplete ? "Reopen" : "Complete"} ${milestone.title}`}
                    className="orbit-button-secondary px-3 py-1.5 text-xs"
                    disabled={isSubmitting}
                    onClick={() =>
                      onUpdate(
                        milestone.id,
                        valuesFromMilestone(milestone, isComplete ? null : new Date().toISOString()),
                      )
                    }
                    type="button"
                  >
                    {isComplete ? <RotateCcw size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                    {isComplete ? "Reopen" : "Complete"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {isCreateOpen ? (
        <Modal title="Add milestone" onClose={() => setIsCreateOpen(false)}>
          <MilestoneForm
            isSubmitting={isSubmitting}
            onSubmit={(values) => {
              onCreate(values);
              setIsCreateOpen(false);
            }}
          />
        </Modal>
      ) : null}

      {editingMilestone ? (
        <Modal title="Edit milestone" onClose={() => setEditingMilestone(null)}>
          <MilestoneForm
            initialMilestone={editingMilestone}
            isSubmitting={isSubmitting}
            onSubmit={(values) => {
              onUpdate(editingMilestone.id, {
                ...values,
                completedAt: editingMilestone.completed_at,
                sortOrder: editingMilestone.sort_order,
              });
              setEditingMilestone(null);
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
