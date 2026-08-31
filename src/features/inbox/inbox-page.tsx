import { InlineAlert } from "../../components/inline-alert";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Clock, FileText, Inbox, ListPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { Field } from "../../components/field";
import { PageHeader, QuietPanel } from "../../components/minimal-layout";
import { StatusPill } from "../../components/status-pill";
import { supabase } from "../../lib/supabase/client";
import type { Database, ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { createNote } from "../notes/notes.queries";
import { listProjects } from "../projects/projects.queries";
import { createWorkItem, workItemStatuses } from "../work-items/work-items.queries";
import { listInboxCaptures, updateCapture } from "./captures.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";

type Capture = Database["public"]["Tables"]["captures"]["Row"];
type ActionMode = "task" | "note";

const priorities = ["low", "medium", "high", "critical"] as const;

function captureLabel(type: Capture["type"]) {
  return type.replaceAll("_", " ");
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function InboxPage() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<ActionMode>("task");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskPriority, setTaskPriority] = useState<ProjectPriority>("medium");
  const [taskStatus, setTaskStatus] = useState<WorkItemStatus>("backlog");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [noteProjectId, setNoteProjectId] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const queryKey = ["inbox-captures", workspaceId] as const;

  const resetTriageFields = useCallback(() => {
    setActiveMode("task");
    setTaskProjectId("");
    setTaskPriority("medium");
    setTaskStatus("backlog");
    setTaskDueDate("");
    setNoteProjectId("");
  }, []);

  function selectCapture(captureId: string) {
    setSelectedCaptureId(captureId);
    resetTriageFields();
    setSuccessMessage("");
  }

  const inboxQuery = useQuery({
    queryKey,
    queryFn: () => listInboxCaptures(supabase, workspaceId),
    enabled: Boolean(user),
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => listProjects(supabase, workspaceId),
    enabled: Boolean(user),
  });

  const captures = inboxQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  useEffect(() => {
    const selectedCaptureStillExists = captures.some((capture) => capture.id === selectedCaptureId);
    const nextSelectedCaptureId = selectedCaptureStillExists ? selectedCaptureId : captures[0]?.id ?? null;

    if (nextSelectedCaptureId === selectedCaptureId) return;

    setSelectedCaptureId(nextSelectedCaptureId);
    resetTriageFields();
  }, [captures, resetTriageFields, selectedCaptureId]);

  const markProcessedMutation = useMutation({
    mutationFn: (capture: Capture) => {

      return updateCapture(supabase, {
        id: capture.id,
        workspaceId,
        projectId: capture.project_id,
        processedAt: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      setSuccessMessage("Capture archived.");
      resetTriageFields();
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (capture: Capture) => {
      if (!user) throw new Error("Workspace and user are required to create tasks.");

      const projectId = taskProjectId || capture.project_id;
      if (!projectId) throw new Error("Choose a project before creating a task.");

      const taskInput: Parameters<typeof createWorkItem>[1] = {
        workspaceId,
        projectId,
        userId: user.id,
        title: capture.title,
        description: capture.body ?? "",
        priority: taskPriority,
        status: taskStatus,
      };

      if (taskDueDate) {
        taskInput.dueDate = taskDueDate;
      }

      await createWorkItem(supabase, taskInput);

      return updateCapture(supabase, {
        id: capture.id,
        workspaceId,
        projectId,
        processedAt: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      setSuccessMessage("Task created from capture.");
      resetTriageFields();
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (capture: Capture) => {
      if (!user) throw new Error("Workspace and user are required to create notes.");

      const projectId = noteProjectId || capture.project_id || undefined;

      await createNote(supabase, {
        workspaceId,
        projectId,
        userId: user.id,
        noteType: capture.type === "idea" ? "idea" : "reference",
        title: capture.title,
        body: capture.body ?? "",
        tags: ["inbox"],
      });

      return updateCapture(supabase, {
        id: capture.id,
        workspaceId,
        projectId: projectId ?? null,
        processedAt: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      setSuccessMessage("Note created from capture.");
      resetTriageFields();
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading inbox" message="Checking your session before loading captured signals." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to process your inbox." />;
  }

  const isMutating = markProcessedMutation.isPending || createTaskMutation.isPending || createNoteMutation.isPending;
  const selectedCapture = captures.find((capture) => capture.id === selectedCaptureId) ?? null;
  const selectedTaskProjectId = selectedCapture ? taskProjectId || selectedCapture.project_id || "" : "";

  return (
    <section className="orbit-page-enter grid gap-6">
      <PageHeader
        action={<StatusPill tone={captures.length > 0 ? "warning" : "good"}>{captures.length} open</StatusPill>}
        title="Inbox"
      >
        Process one signal at a time — convert, assign, or archive.
      </PageHeader>

      {inboxQuery.isPending || projectsQuery.isPending ? (
        <EmptyState isLoading title="Loading inbox" message="Fetching unprocessed captures." />
      ) : null}

      {inboxQuery.isError ? <EmptyState title="Could not load inbox" message={inboxQuery.error.message} /> : null}
      {projectsQuery.isError ? <EmptyState title="Could not load projects" message={projectsQuery.error.message} /> : null}

      {successMessage ? (
        <InlineAlert tone="success">
          {successMessage}
        </InlineAlert>
      ) : null}

      {[markProcessedMutation, createTaskMutation, createNoteMutation].map((mutation, index) =>
        mutation.isError ? (
          <InlineAlert key={index} tone="error">
            {mutation.error.message}
          </InlineAlert>
        ) : null,
      )}

      {!inboxQuery.isPending &&
      !inboxQuery.isError &&
      !projectsQuery.isPending &&
      !projectsQuery.isError &&
      captures.length === 0 ? (
        <QuietPanel className="relative isolate mx-auto w-full max-w-4xl overflow-hidden p-8" aria-label="Inbox queue">
          <div aria-hidden="true" className="inbox-stack-edges" />
          <EmptyState
            className="relative border-0 bg-transparent shadow-none"
            illustration="inbox"
            title="Inbox clear"
            message="New quick captures will arrive here until you process them."
          />
          <div className="relative mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200">
              <Clock aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Quick captures are stored here</p>
              <p className="mt-0.5 text-sm leading-6 text-slate-400">
                We&apos;ll keep them safe until you&apos;re ready to take action.
              </p>
            </div>
          </div>
        </QuietPanel>
      ) : null}

      {!inboxQuery.isPending && !projectsQuery.isPending && captures.length > 0 ? (
        <div className="mx-auto grid w-full max-w-4xl gap-4">
          {selectedCapture ? (
            <div className="surface-raised rounded-xl p-5" key={selectedCapture.id}>
              <div className="relative grid gap-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                        <Inbox size={16} aria-hidden="true" />
                      </span>
                      <StatusPill>{captureLabel(selectedCapture.type)}</StatusPill>
                    </div>
                    <h2 className="mt-3 break-words text-2xl font-black text-white">{selectedCapture.title}</h2>
                  </div>
                  <button
                    aria-label={`Archive ${selectedCapture.title}`}
                    className="orbit-button-secondary w-fit"
                    disabled={isMutating}
                    onClick={() => {
                      setSuccessMessage("");
                      markProcessedMutation.mutate(selectedCapture);
                    }}
                    type="button"
                  >
                    <Archive size={15} aria-hidden="true" />
                    Archive
                  </button>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-400">
                  {selectedCapture.body || "No body captured."}
                </p>

                <div className="grid gap-4 border-t border-slate-400/15 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-label={`Show task options for ${selectedCapture.title}`}
                      aria-pressed={activeMode === "task"}
                      className={activeMode === "task" ? "orbit-button" : "orbit-button-secondary"}
                      disabled={isMutating}
                      onClick={() => setActiveMode("task")}
                      type="button"
                    >
                      <ListPlus size={15} aria-hidden="true" />
                      Task
                    </button>
                    <button
                      aria-label={`Show note options for ${selectedCapture.title}`}
                      aria-pressed={activeMode === "note"}
                      className={activeMode === "note" ? "orbit-button" : "orbit-button-secondary"}
                      disabled={isMutating}
                      onClick={() => setActiveMode("note")}
                      type="button"
                    >
                      <FileText size={15} aria-hidden="true" />
                      Note
                    </button>
                  </div>

                  {activeMode === "task" ? (
                    <div className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Field label="Task project">
                          <select
                            className="orbit-input"
                            disabled={isMutating}
                            onChange={(event) => setTaskProjectId(event.target.value)}
                            value={selectedTaskProjectId}
                          >
                            <option value="">Choose project</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Task priority">
                          <select
                            className="orbit-input capitalize"
                            disabled={isMutating}
                            onChange={(event) => setTaskPriority(event.target.value as ProjectPriority)}
                            value={taskPriority}
                          >
                            {priorities.map((priority) => (
                              <option key={priority} value={priority}>
                                {priority}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Task status">
                          <select
                            className="orbit-input capitalize"
                            disabled={isMutating}
                            onChange={(event) => setTaskStatus(event.target.value as WorkItemStatus)}
                            value={taskStatus}
                          >
                            {workItemStatuses.map((status) => (
                              <option key={status} value={status}>
                                {formatLabel(status)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Task due date">
                          <input
                            className="orbit-input"
                            disabled={isMutating}
                            onChange={(event) => setTaskDueDate(event.target.value)}
                            type="date"
                            value={taskDueDate}
                          />
                        </Field>
                      </div>

                      <div className="flex justify-end">
                        <button
                          aria-label={`Create task from ${selectedCapture.title}`}
                          className="orbit-button"
                          disabled={isMutating}
                          onClick={() => {
                            setSuccessMessage("");
                            createTaskMutation.mutate(selectedCapture);
                          }}
                          type="button"
                        >
                          <ListPlus size={15} aria-hidden="true" />
                          Create task
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <Field label="Note project">
                        <select
                          className="orbit-input"
                          disabled={isMutating}
                          onChange={(event) => setNoteProjectId(event.target.value)}
                          value={noteProjectId}
                        >
                          <option value="">No project</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <div className="flex justify-end">
                        <button
                          aria-label={`Create note from ${selectedCapture.title}`}
                          className="orbit-button"
                          disabled={isMutating}
                          onClick={() => {
                            setSuccessMessage("");
                            createNoteMutation.mutate(selectedCapture);
                          }}
                          type="button"
                        >
                          <FileText size={15} aria-hidden="true" />
                          Create note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="surface-quiet rounded-xl p-3">
            <div className="relative flex items-center justify-between gap-3 px-1 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Up next</p>
              <span className="rounded-full border border-slate-400/20 px-2 py-0.5 text-xs font-semibold text-slate-300">
                {captures.length}
              </span>
            </div>
            <ul className="relative grid gap-1">
              {captures.map((capture) => {
                const isSelected = capture.id === selectedCapture?.id;

                return (
                  <li key={capture.id}>
                    <button
                      aria-pressed={isSelected}
                      className={`w-full rounded-md border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-blue-300/30 bg-blue-300/[0.07]"
                          : "border-transparent bg-transparent hover:border-cyan-300/25 hover:bg-slate-900/50"
                      }`}
                      onClick={() => selectCapture(capture.id)}
                      type="button"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">{capture.title}</span>
                          <span className="mt-1 block text-xs capitalize text-slate-400">{captureLabel(capture.type)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
