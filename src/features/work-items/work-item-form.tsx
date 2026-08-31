import { clsx } from "clsx";
import { Paperclip, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";
import { labelBarClasses, type Label } from "./work-item-details.queries";
import { workItemStatuses } from "./work-items.queries";

const priorities = ["low", "medium", "high", "critical"] as const;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface WorkItemFormValues {
  title: string;
  description: string;
  dueDate: string;
  status: WorkItemStatus;
  priority: ProjectPriority;
  labelIds: string[];
  checklistItems: string[];
  files: File[];
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function WorkItemForm({
  labels = [],
  isSubmitting = false,
  onSubmit,
}: {
  labels?: Label[];
  isSubmitting?: boolean;
  onSubmit: (values: WorkItemFormValues) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<WorkItemStatus>("backlog");
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");

  function toggleLabel(labelId: string) {
    setLabelIds((current) =>
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId],
    );
  }

  function addChecklistItem() {
    const trimmed = checklistDraft.trim();
    if (!trimmed) return;
    setChecklistItems((current) => [...current, trimmed]);
    setChecklistDraft("");
  }

  function stageFiles(picked: FileList | null) {
    if (!picked) return;
    setFileError("");
    const accepted: File[] = [];
    for (const file of Array.from(picked)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setFileError("Attachments are limited to 10 MB.");
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) setFiles((current) => [...current, ...accepted]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    onSubmit({
      title: trimmedTitle,
      description: description.trim(),
      dueDate,
      status,
      priority,
      labelIds,
      checklistItems,
      files,
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deadline">
          <input
            className="orbit-input"
            disabled={isSubmitting}
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
            value={dueDate}
          />
        </Field>

        <Field label="Status">
          <select
            className="orbit-input capitalize"
            disabled={isSubmitting}
            onChange={(event) => setStatus(event.target.value as WorkItemStatus)}
            value={status}
          >
            {workItemStatuses.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority">
          <select
            className="orbit-input capitalize"
            disabled={isSubmitting}
            onChange={(event) => setPriority(event.target.value as ProjectPriority)}
            value={priority}
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {labels.length > 0 ? (
        <div className="grid gap-1.5">
          <p className="text-sm font-medium text-slate-200">Labels</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {labels.map((label) => (
              <label className="flex items-center gap-1.5 text-sm text-slate-200" key={label.id}>
                <input
                  aria-label={label.name}
                  checked={labelIds.includes(label.id)}
                  className="h-4 w-4 accent-cyan-300"
                  disabled={isSubmitting}
                  onChange={() => toggleLabel(label.id)}
                  type="checkbox"
                />
                <span aria-hidden="true" className={clsx("h-2.5 w-2.5 rounded-full", labelBarClasses[label.color])} />
                {label.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-slate-200">Checklist</p>
        {checklistItems.length > 0 ? (
          <ul className="grid gap-1">
            {checklistItems.map((item, index) => (
              <li className="flex items-center gap-2 text-sm text-slate-300" key={`${item}-${index}`}>
                <span className="flex-1 truncate">{item}</span>
                <button
                  aria-label={`Remove ${item}`}
                  className="text-slate-600 transition hover:text-rose-200"
                  onClick={() => setChecklistItems((current) => current.filter((_, i) => i !== index))}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          aria-label="New checklist item"
          className="orbit-input px-2.5 py-1.5 text-sm"
          disabled={isSubmitting}
          onChange={(event) => setChecklistDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addChecklistItem();
            }
          }}
          placeholder="Add checklist item — Enter to stage"
          value={checklistDraft}
        />
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-200">Attachments</p>
          <button
            className="orbit-button-secondary px-2.5 py-1.5 text-xs"
            disabled={isSubmitting}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
            Attach files
          </button>
          <input
            aria-label="Attach files"
            className="hidden"
            multiple
            onChange={(event) => {
              stageFiles(event.target.files);
              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
        </div>
        {fileError ? <p className="text-xs font-semibold text-rose-200">{fileError}</p> : null}
        {files.length > 0 ? (
          <ul className="grid gap-1">
            {files.map((file, index) => (
              <li className="flex items-center gap-2 text-sm text-slate-300" key={`${file.name}-${index}`}>
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatBytes(file.size)}</span>
                <button
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 text-slate-600 transition hover:text-rose-200"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex justify-end">
        <button
          className="orbit-button"
          disabled={isSubmitting || !title.trim()}
          type="submit"
        >
          {isSubmitting ? "Launching..." : "Launch task"}
        </button>
      </div>
    </form>
  );
}
