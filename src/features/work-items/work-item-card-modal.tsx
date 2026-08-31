import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { FileText, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useRef, useState, type FormEvent, type MouseEvent, type FocusEvent } from "react";
import { Field } from "../../components/field";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { supabase } from "../../lib/supabase/client";
import type { Database, LabelColor, ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { listMembers, membersQueryKey } from "../members/members.queries";
import {
  assignLabel,
  createChecklistItem,
  createComment,
  createLabel,
  deleteAttachment,
  deleteChecklistItem,
  deleteComment,
  getAttachmentUrl,
  labelBarClasses,
  labelColorClasses,
  labelColors,
  listAttachments,
  listChecklistItems,
  listComments,
  listProjectLabels,
  listWorkItemLabels,
  toggleChecklistItem,
  unassignLabel,
  uploadAttachment,
  workItemDetailsKeys,
} from "./work-item-details.queries";
import { workItemStatuses } from "./work-items.queries";
import { BacklinksPanel } from "../links/backlinks-panel";
import { LinkedText } from "../links/linked-text";
import { LinkingTextarea } from "../links/linking-textarea";
import { MentionsPanel } from "../links/mentions-panel";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];
type Milestone = Database["public"]["Tables"]["milestones"]["Row"];

const priorities = ["low", "medium", "high", "critical"] as const;
const taskModalGridClass =
  "grid max-h-[min(46rem,calc(100vh-6rem))] overflow-hidden lg:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]";
const taskModalMainClass = "orbit-scrollbar min-w-0 overflow-y-auto p-6";
const taskModalRailClass =
  "orbit-scrollbar min-w-0 overflow-y-auto border-l border-white/[0.08] bg-[#060c1e]/72 p-5";

export interface WorkItemDetailValues {
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: ProjectPriority;
  dueDate: string;
  milestoneId: string;
  assignedTo: string;
  blockedReason: string;
  plannedAt: string;
  plannedMinutes: string;
}

function formatLabel(value: string) {
  if (value === "ready") return "Ready to Launch";
  return value.replaceAll("_", " ");
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function WorkItemCardModal({
  item,
  milestones = [],
  isSubmitting = false,
  onClose,
  onSubmit,
}: {
  item: WorkItem;
  milestones?: Milestone[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: WorkItemDetailValues) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assignment is restricted to workspace members by a foreign key, so the
  // picker offers exactly that set.
  const membersQuery = useQuery({
    queryKey: membersQueryKey(item.workspace_id),
    queryFn: () => listMembers(supabase, item.workspace_id),
  });
  const members = membersQuery.data ?? [];

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<WorkItemStatus>(item.status);
  const [priority, setPriority] = useState<ProjectPriority>(item.priority);
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [milestoneId, setMilestoneId] = useState(item.milestone_id ?? "");
  const [assignedTo, setAssignedTo] = useState(item.assigned_to ?? "");
  const [blockedReason, setBlockedReason] = useState(item.blocked_reason ?? "");
  const [plannedAt, setPlannedAt] = useState(item.planned_at?.slice(0, 5) ?? "");
  const [plannedMinutes, setPlannedMinutes] = useState(
    item.planned_minutes === null ? "" : String(item.planned_minutes),
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [checklistDraft, setChecklistDraft] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>("cyan");

  const workspaceId = item.workspace_id;
  const workItemId = item.id;
  const detailsKey = workItemDetailsKeys.details(workspaceId, workItemId);
  const labelsKey = workItemDetailsKeys.labels(workspaceId, item.project_id);
  const metaKey = workItemDetailsKeys.meta(workspaceId, item.project_id);

  const commentsQuery = useQuery({
    queryKey: [...detailsKey, "comments"],
    queryFn: () => listComments(supabase, { workspaceId, workItemId }),
  });
  const checklistQuery = useQuery({
    queryKey: [...detailsKey, "checklist"],
    queryFn: () => listChecklistItems(supabase, { workspaceId, workItemId }),
  });
  const attachmentsQuery = useQuery({
    queryKey: [...detailsKey, "attachments"],
    queryFn: () => listAttachments(supabase, { workspaceId, workItemId }),
  });
  const projectLabelsQuery = useQuery({
    queryKey: labelsKey,
    queryFn: () => listProjectLabels(supabase, { workspaceId, projectId: item.project_id }),
  });
  const itemLabelsQuery = useQuery({
    queryKey: [...detailsKey, "labels"],
    queryFn: () => listWorkItemLabels(supabase, { workspaceId, workItemId }),
  });

  async function invalidateDetails() {
    await queryClient.invalidateQueries({ queryKey: detailsKey });
    await queryClient.invalidateQueries({ queryKey: metaKey });
  }

  const commentMutation = useMutation({
    mutationFn: (body: string) =>
      createComment(supabase, { workspaceId, workItemId, userId: user?.id ?? "", body }),
    onSuccess: async () => {
      setCommentDraft("");
      await invalidateDetails();
    },
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (id: string) => deleteComment(supabase, { id, workspaceId }),
    onSuccess: invalidateDetails,
  });
  const addChecklistMutation = useMutation({
    mutationFn: (input: { title: string; sortOrder: number }) =>
      createChecklistItem(supabase, {
        workspaceId,
        workItemId,
        userId: user?.id ?? "",
        title: input.title,
        sortOrder: input.sortOrder,
      }),
    onSuccess: async () => {
      setChecklistDraft("");
      await invalidateDetails();
    },
  });
  const toggleChecklistMutation = useMutation({
    mutationFn: (input: { id: string; isDone: boolean }) =>
      toggleChecklistItem(supabase, { id: input.id, workspaceId, isDone: input.isDone }),
    onSuccess: invalidateDetails,
  });
  const deleteChecklistMutation = useMutation({
    mutationFn: (id: string) => deleteChecklistItem(supabase, { id, workspaceId }),
    onSuccess: invalidateDetails,
  });
  const assignLabelMutation = useMutation({
    mutationFn: (labelId: string) => assignLabel(supabase, { workspaceId, workItemId, labelId }),
    onSuccess: invalidateDetails,
  });
  const unassignLabelMutation = useMutation({
    mutationFn: (labelId: string) => unassignLabel(supabase, { workspaceId, workItemId, labelId }),
    onSuccess: invalidateDetails,
  });
  const createLabelMutation = useMutation({
    mutationFn: (input: { name: string; color: LabelColor }) =>
      createLabel(supabase, {
        workspaceId,
        projectId: item.project_id,
        userId: user?.id ?? "",
        name: input.name,
        color: input.color,
      }),
    onSuccess: async () => {
      setNewLabelName("");
      await queryClient.invalidateQueries({ queryKey: labelsKey });
    },
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(supabase, { workspaceId, workItemId, userId: user?.id ?? "", file }),
    onSuccess: invalidateDetails,
  });
  const deleteAttachmentMutation = useMutation({
    mutationFn: (input: { id: string; storagePath: string }) =>
      deleteAttachment(supabase, { id: input.id, workspaceId, storagePath: input.storagePath }),
    onSuccess: invalidateDetails,
  });

  const comments = commentsQuery.data ?? [];
  const checklist = checklistQuery.data ?? [];
  const attachments = attachmentsQuery.data ?? [];
  const projectLabels = projectLabelsQuery.data ?? [];
  const itemLabels = itemLabelsQuery.data ?? [];
  const assignedLabelIds = new Set(itemLabels.map((label) => label.id));
  const checklistDone = checklist.filter((entry) => entry.is_done).length;
  const checklistPercent = checklist.length > 0 ? Math.round((checklistDone / checklist.length) * 100) : 0;

  const nextAction =
    status === "blocked"
      ? "Clear the blocker or move this task back into motion."
      : dueDate
        ? "Protect time before the deadline and keep the next move small."
        : "Add a deadline or move this into focus when it becomes active.";

  const mutationErrors = [
    commentMutation,
    deleteCommentMutation,
    addChecklistMutation,
    toggleChecklistMutation,
    deleteChecklistMutation,
    assignLabelMutation,
    unassignLabelMutation,
    createLabelMutation,
    uploadMutation,
    deleteAttachmentMutation,
  ].filter((mutation) => mutation.isError);

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSubmit({
      title: trimmedTitle,
      description: description.trim(),
      status,
      priority,
      dueDate,
      milestoneId,
      assignedTo,
      blockedReason: blockedReason.trim(),
      plannedAt,
      plannedMinutes,
    });
  }

  function handleDescriptionClick(event: MouseEvent<HTMLDivElement>) {
    // A link inside the description must navigate rather than open the editor.
    // Without this, any orbit: link in a description can never be followed —
    // and the feature still looks correct until someone tries.
    if ((event.target as HTMLElement).closest("a")) return;
    setIsEditingDescription(true);
  }

  function handleDescriptionBlur(event: FocusEvent<HTMLTextAreaElement>) {
    // LinkingTextarea renders its [[ and @ picker INSIDE this region. Closing
    // on every blur would unmount the picker the moment you reached for an
    // option, so the click would never land. Staying open when focus moves
    // somewhere inside the region is what makes the picker usable here.
    const next = event.relatedTarget as Node | null;
    if (next && descriptionRef.current?.contains(next)) return;
    setIsEditingDescription(false);
  }

  function submitChecklistDraft() {
    const trimmed = checklistDraft.trim();
    if (!trimmed) return;
    addChecklistMutation.mutate({ title: trimmed, sortOrder: checklist.length });
  }

  async function openAttachment(storagePath: string) {
    const url = await getAttachmentUrl(supabase, storagePath);
    window.open(url, "_blank", "noopener");
  }

  return (
    <Modal className="work-item-card-modal" onClose={onClose} size="lg" title={title || "Task details"}>
      <form className={taskModalGridClass} id="work-item-core-form" onSubmit={handleSave}>
        <main className={taskModalMainClass}>
          <div className="grid content-start gap-6">
            {mutationErrors.map((mutation, index) => (
              <InlineAlert key={index} tone="error">
                {(mutation.error as Error).message}
              </InlineAlert>
            ))}

            <div className="grid gap-3">
              <Field label="Title">
                <input
                  className="orbit-input"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </Field>

              {itemLabels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {itemLabels.map((label) => (
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                        labelColorClasses[label.color],
                      )}
                      key={label.id}
                    >
                      {label.name}
                      <button
                        aria-label={`Remove label ${label.name}`}
                        className="opacity-70 hover:opacity-100"
                        onClick={() => unassignLabelMutation.mutate(label.id)}
                        type="button"
                      >
                        <X aria-hidden="true" className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Not <Field>: it wraps children in a <label>, which has no form
                  control to point at while the description is rendered, and
                  would swallow clicks meant for the Edit button. */}
              <div className="grid gap-1 text-sm" ref={descriptionRef}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-200">
                    Description
                  </span>
                  {isEditingDescription ? null : (
                    <button
                      className="text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
                      onClick={() => setIsEditingDescription(true)}
                      type="button"
                    >
                      Edit description
                    </button>
                  )}
                </div>

                {isEditingDescription ? (
                  <LinkingTextarea
                    aria-label="Description"
                    autoFocus
                    className="orbit-input min-h-24"
                    onBlur={handleDescriptionBlur}
                    onChange={setDescription}
                    value={description}
                  />
                ) : (
                  <div
                    className="orbit-prose min-h-24 cursor-text break-words rounded-md border border-slate-400/15 px-3 py-2 text-sm leading-6 text-slate-200"
                    onClick={handleDescriptionClick}
                  >
                    {description.trim() ? (
                      <LinkedText body={description} />
                    ) : (
                      <span className="text-slate-500">Add a description</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">Checklist</h3>
                {checklist.length > 0 ? (
                  <span
                    className={clsx(
                      "text-xs font-semibold",
                      checklistDone === checklist.length ? "text-emerald-200" : "text-slate-400",
                    )}
                  >
                    {checklistDone}/{checklist.length}
                  </span>
                ) : null}
              </div>
              {checklist.length > 0 ? (
                <>
                  <div
                    aria-describedby="checklist-progress-copy"
                    aria-label="Checklist progress"
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={checklistPercent}
                    className={clsx(
                      "work-item-progress",
                      checklistDone === checklist.length && "work-item-progress-complete",
                    )}
                    role="progressbar"
                  >
                    <span style={{ width: `${checklistPercent}%` }} />
                  </div>
                  <span className="sr-only" id="checklist-progress-copy">
                    {checklistDone} of {checklist.length} complete
                  </span>
                </>
              ) : null}
              <ul className="grid gap-1">
                {checklist.map((entry) => (
                  <li className="group flex items-center gap-2" key={entry.id}>
                    <input
                      aria-label={entry.title}
                      checked={entry.is_done}
                      className="h-4 w-4 accent-cyan-300"
                      onChange={() => toggleChecklistMutation.mutate({ id: entry.id, isDone: !entry.is_done })}
                      type="checkbox"
                    />
                    <span className={clsx("flex-1 text-sm", entry.is_done ? "text-slate-500 line-through" : "text-slate-200")}>
                      {entry.title}
                    </span>
                    <button
                      aria-label={`Delete ${entry.title}`}
                      className="text-slate-600 opacity-0 transition hover:text-rose-200 group-hover:opacity-100"
                      onClick={() => deleteChecklistMutation.mutate(entry.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <input
                aria-label="New checklist item"
                className="orbit-input px-2.5 py-1.5 text-sm"
                onChange={(event) => setChecklistDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitChecklistDraft();
                  }
                }}
                placeholder="Add checklist item — Enter to save"
                value={checklistDraft}
              />
            </section>

            <section className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <BacklinksPanel id={item.id} kind="task" />
                <MentionsPanel id={item.id} kind="task" title={item.title} />
              </div>

              <div className="grid gap-3">
                <h3 className="text-sm font-semibold text-white">Attachments</h3>
                <button
                  className="orbit-button-secondary px-2.5 py-1.5 text-xs"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
                  {uploadMutation.isPending ? "Uploading..." : "Attach file"}
                </button>
                <input
                  aria-label="Attach file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                    event.target.value = "";
                  }}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-slate-500">No files attached.</p>
              ) : (
                <ul className="grid gap-2">
                  {attachments.map((attachment) => (
                    <li className="work-item-detail-row flex items-center gap-3" key={attachment.id}>
                      <span
                        aria-hidden="true"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-slate-950/40 text-cyan-200"
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-100">
                          {attachment.file_name}
                        </span>
                        <span className="block text-xs text-slate-500">{formatBytes(attachment.size_bytes)}</span>
                      </span>
                      <button
                        aria-label={`Download ${attachment.file_name}`}
                        className="orbit-button-tertiary shrink-0 px-2 py-1 text-xs"
                        onClick={() => void openAttachment(attachment.storage_path)}
                        type="button"
                      >
                        Download
                      </button>
                      <button
                        aria-label={`Delete ${attachment.file_name}`}
                        className="orbit-field-icon-button"
                        onClick={() =>
                          deleteAttachmentMutation.mutate({ id: attachment.id, storagePath: attachment.storage_path })
                        }
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-2">
              <h3 className="text-sm font-semibold text-white">Comments</h3>
              <ul className="grid gap-2">
                {comments.map((comment) => (
                  <li className="work-item-detail-row flex items-start gap-3" key={comment.id}>
                    <span aria-hidden="true" className="work-item-comment-avatar" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-300">You</span>
                          {" · "}
                          <time dateTime={comment.created_at}>{comment.created_at.slice(0, 10)}</time>
                        </p>
                        <button
                          aria-label="Delete comment"
                          className="orbit-field-icon-button"
                          onClick={() => deleteCommentMutation.mutate(comment.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="orbit-prose mt-1 break-words text-sm leading-6 text-slate-200">
                        <LinkedText body={comment.body} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <LinkingTextarea
                aria-label="Add a comment"
                className="orbit-input min-h-16 text-sm"
                onChange={setCommentDraft}
                placeholder="Write a comment..."
                value={commentDraft}
              />
              <div className="flex justify-end">
                <button
                  className="orbit-button-secondary px-3 py-1.5 text-xs"
                  disabled={commentMutation.isPending || !commentDraft.trim()}
                  onClick={() => commentMutation.mutate(commentDraft.trim())}
                  type="button"
                >
                  Comment
                </button>
              </div>
            </section>
          </div>
        </main>

        <aside className={taskModalRailClass}>
          <div className="grid content-start gap-4">
            <div className="surface-whisper grid gap-1 rounded-lg p-3 text-xs text-slate-400">
              <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">Context snapshot</p>
              <p className="leading-5 text-slate-300">{nextAction}</p>
            </div>

            <Field label="Status">
              <select
                className="orbit-input capitalize"
                form="work-item-core-form"
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
                form="work-item-core-form"
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

            <Field label="Deadline">
              <input
                className="orbit-input"
                form="work-item-core-form"
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
            </Field>

            <Field label="Planned time">
              <input
                className="orbit-input"
                form="work-item-core-form"
                onChange={(event) => setPlannedAt(event.target.value)}
                type="time"
                value={plannedAt}
              />
            </Field>

            <Field label="Planned minutes">
              <input
                className="orbit-input"
                form="work-item-core-form"
                max={480}
                min={5}
                onChange={(event) => setPlannedMinutes(event.target.value)}
                placeholder="45"
                type="number"
                value={plannedMinutes}
              />
            </Field>

            <Field label="Milestone">
              <select
                className="orbit-input"
                form="work-item-core-form"
                onChange={(event) => setMilestoneId(event.target.value)}
                value={milestoneId}
              >
                <option value="">No milestone</option>
                {milestones.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Assignee">
              <select
                className="orbit-input"
                form="work-item-core-form"
                onChange={(event) => setAssignedTo(event.target.value)}
                value={assignedTo}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Blocker">
              <input
                className="orbit-input"
                form="work-item-core-form"
                onChange={(event) => setBlockedReason(event.target.value)}
                value={blockedReason}
              />
            </Field>

            <section className="grid gap-2 border-t border-slate-400/10 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Labels</h3>
              <ul className="grid gap-1">
                {projectLabels.map((label) => (
                  <li key={label.id}>
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        aria-label={label.name}
                        checked={assignedLabelIds.has(label.id)}
                        className="h-4 w-4 accent-cyan-300"
                        onChange={() =>
                          assignedLabelIds.has(label.id)
                            ? unassignLabelMutation.mutate(label.id)
                            : assignLabelMutation.mutate(label.id)
                        }
                        type="checkbox"
                      />
                      <span aria-hidden="true" className={clsx("h-2.5 w-2.5 rounded-full", labelBarClasses[label.color])} />
                      <span className="min-w-0 truncate">{label.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <input
                aria-label="New label name"
                className="orbit-input px-2.5 py-1.5 text-sm"
                onChange={(event) => setNewLabelName(event.target.value)}
                placeholder="New label"
                value={newLabelName}
              />
              <div aria-label="Label color" className="flex gap-1.5" role="radiogroup">
                {labelColors.map((color) => (
                  <button
                    aria-checked={newLabelColor === color}
                    aria-label={`Label color ${color}`}
                    className={clsx(
                      "h-5 w-5 rounded-full border",
                      labelColorClasses[color],
                      newLabelColor === color && "ring-2 ring-white/60",
                    )}
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    role="radio"
                    type="button"
                  />
                ))}
              </div>
              <button
                className="orbit-button-secondary justify-center px-2.5 py-1.5 text-xs"
                disabled={createLabelMutation.isPending || !newLabelName.trim()}
                onClick={() => createLabelMutation.mutate({ name: newLabelName.trim(), color: newLabelColor })}
                type="button"
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                Add label
              </button>
            </section>

            <button
              className="orbit-button justify-center"
              disabled={isSubmitting}
              form="work-item-core-form"
              type="submit"
            >
              {isSubmitting ? "Saving..." : "Save task"}
            </button>
          </div>
        </aside>
      </form>
    </Modal>
  );
}
