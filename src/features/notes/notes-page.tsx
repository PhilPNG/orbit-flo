import { InlineAlert } from "../../components/inline-alert";
import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { Modal } from "../../components/modal";
import { StatusPill } from "../../components/status-pill";
import { orbitAssets } from "../../lib/orbit-assets";
import { supabase } from "../../lib/supabase/client";
import type { NoteType } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { createWorkItem } from "../work-items/work-items.queries";
import { NoteForm, type NoteFormValues } from "./note-form";
import { createNote, listNotes, notesKeys, noteTypeLabel, noteTypes } from "./notes.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { LinkedText } from "../links/linked-text";
import { buildTagIndex, matchesTags, normalizeTags } from "./note-tags";
import { LinkGraphPanel } from "../links/link-graph-panel";

type NoteFilter = NoteType | "all";
type Note = Awaited<ReturnType<typeof listNotes>>[number];
const noteFilters = ["all", ...noteTypes] as const;

const brainstormInsights = [
  { title: "Capture early", body: "Half-formed thoughts are welcome — orbit now, refine later." },
  { title: "Many perspectives", body: "Mix ideas, questions, decisions, and risks to see the whole sky." },
  { title: "From thought to action", body: "Promote a signal into a mission task when it is ready to fly." },
];

export function NotesPage({ projectId }: { projectId?: string }) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [activeFilter, setActiveFilter] = useState<NoteFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [noteTaskMessage, setNoteTaskMessage] = useState("");
  const filterRefs = useRef<Map<NoteFilter, HTMLButtonElement>>(new Map());
  const notesQueryKey =
    projectId
      ? notesKeys.project(workspaceId, projectId)
      : notesKeys.workspace(workspaceId);

  const notesQuery = useQuery({
    queryKey: notesQueryKey,
    queryFn: () => listNotes(supabase, workspaceId, projectId),
    enabled: Boolean(user),
  });

  const createNoteMutation = useMutation({
    mutationFn: (values: NoteFormValues) => {
      if (!user) {
        throw new Error("Choose a workspace before creating notes.");
      }

      return createNote(supabase, {
        workspaceId,
        projectId,
        userId: user.id,
        noteType: values.noteType,
        title: values.title,
        body: values.body,
        tags: values.tags,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notesKeys.workspace(workspaceId) });
      setIsCreateOpen(false);
    },
  });

  const createTaskFromNoteMutation = useMutation({
    mutationFn: (note: Note) => {
      if (!projectId || !user) {
        throw new Error("Choose a project before creating a task from a note.");
      }

      return createWorkItem(supabase, {
        workspaceId,
        projectId,
        userId: user.id,
        title: note.title,
        description: note.body ?? "",
        priority: "medium",
        status: "backlog",
      });
    },
    onSuccess: async () => {
      setNoteTaskMessage("Task created from note.");
      await queryClient.invalidateQueries({ queryKey: ["work-items", workspaceId, projectId] });
    },
  });

  const notes = notesQuery.data ?? [];

  // Reveals the note named by a search deep link. The type filter is cleared
  // first, otherwise the target note can be filtered out of the list.
  const [searchParams, setSearchParams] = useSearchParams();
  const noteRefs = useRef(new Map<string, HTMLLIElement>());
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "graph">("list");
  const requestedNoteId = searchParams.get("note");

  useEffect(() => {
    if (!requestedNoteId || notesQuery.isPending) return;
    if (!notes.some((note) => note.id === requestedNoteId)) return;

    setActiveFilter("all");
    setHighlightedNoteId(requestedNoteId);
    noteRefs.current.get(requestedNoteId)?.scrollIntoView({ block: "center" });

    const next = new URLSearchParams(searchParams);
    next.delete("note");
    setSearchParams(next, { replace: true });

    const timer = window.setTimeout(() => setHighlightedNoteId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [requestedNoteId, notes, notesQuery.isPending, searchParams, setSearchParams]);

  const selectedTags = useMemo(() => {
    const raw = searchParams.get("tags");
    return raw ? normalizeTags(raw.split(",")) : [];
  }, [searchParams]);

  function toggleTag(tag: string) {
    const next = new URLSearchParams(searchParams);
    const wanted = selectedTags.includes(tag)
      ? selectedTags.filter((entry) => entry !== tag)
      : [...selectedTags, tag];

    if (wanted.length > 0) {
      next.set("tags", wanted.join(","));
    } else {
      next.delete("tags");
    }

    setSearchParams(next, { replace: true });
  }

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesType = activeFilter === "all" || note.note_type === activeFilter;
      return matchesType && matchesTags(note.tags, selectedTags);
    });
  }, [activeFilter, notes, selectedTags]);

  // Counted across the type-filtered notes, so the numbers describe what
  // clicking a tag would actually leave on screen.
  const tagIndex = useMemo(
    () =>
      buildTagIndex(
        notes.filter((note) => activeFilter === "all" || note.note_type === activeFilter),
      ),
    [activeFilter, notes],
  );
  const filterCounts = Object.fromEntries(
    noteFilters.map((filter) => [
      filter,
      filter === "all" ? notes.length : notes.filter((note) => note.note_type === filter).length,
    ]),
  ) as Record<NoteFilter, number>;

  function openCreateModal() {
    createNoteMutation.reset();
    setIsCreateOpen(true);
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLButtonElement>, filter: NoteFilter) {
    const currentIndex = noteFilters.indexOf(filter);
    const lastIndex = noteFilters.length - 1;
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % noteFilters.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + noteFilters.length) % noteFilters.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextFilter = noteFilters[nextIndex];
    setActiveFilter(nextFilter);
    filterRefs.current.get(nextFilter)?.focus();
  }

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading signals" message="Checking your session before loading notes." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to capture ideas and decisions." />;
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mission-label">Signal log</p>
          <h1 className="mt-2 text-3xl font-black text-white">{projectId ? "Project notes" : "Brainstorm notes"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {projectId ? "Capture project-specific context and decisions." : "Capture workspace ideas, questions, and decisions before they drift."}
          </p>
        </div>
        <button
          className="orbit-button"
          onClick={openCreateModal}
          type="button"
        >
          <Plus size={16} />
          Capture note
        </button>
      </div>

      {!projectId ? (
        <div aria-label="Brainstorm view" className="flex gap-2" role="tablist">
          {(["list", "graph"] as const).map((value) => (
            <button
              aria-selected={view === value}
              className={
                view === value
                  ? "rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-3 py-1.5 text-xs font-semibold text-cyan-100"
                  : "rounded-lg border border-slate-400/20 bg-slate-400/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-300/30"
              }
              key={value}
              onClick={() => setView(value)}
              role="tab"
              type="button"
            >
              {value === "list" ? "List" : "Graph"}
            </button>
          ))}
        </div>
      ) : null}

      {view === "graph" && !projectId ? <LinkGraphPanel /> : null}

      <div
        aria-label="Brainstorm note filters"
        className="brainstorm-filter-bar"
        hidden={view === "graph" && !projectId}
        role="tablist"
      >
        {noteFilters.map((value) => (
          <button
            aria-controls="brainstorm-filter-results"
            aria-selected={activeFilter === value}
            className={clsx("brainstorm-filter", activeFilter === value && "brainstorm-filter-active")}
            id={`brainstorm-filter-${value}`}
            key={value}
            onKeyDown={(event) => handleFilterKeyDown(event, value)}
            onClick={() => setActiveFilter(value)}
            ref={(element) => {
              if (element) {
                filterRefs.current.set(value, element);
              } else {
                filterRefs.current.delete(value);
              }
            }}
            role="tab"
            tabIndex={activeFilter === value ? 0 : -1}
            type="button"
          >
            <span>{value === "all" ? "All" : noteTypeLabel(value)}</span>
            {" "}
            <span className="brainstorm-filter-count">{filterCounts[value]}</span>
          </button>
        ))}
      </div>

      {tagIndex.length > 0 ? (
        <div aria-label="Filter by tag" className="flex flex-wrap items-center gap-2" hidden={view === "graph" && !projectId}>
          {tagIndex.map(({ tag, count }) => {
            const isSelected = selectedTags.includes(tag);

            return (
              <button
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? "flex items-center gap-1.5 rounded-full border border-cyan-300/40 bg-cyan-300/15 px-2.5 py-1 text-xs font-semibold text-cyan-100"
                    : "flex items-center gap-1.5 rounded-full border border-slate-400/20 bg-slate-400/10 px-2.5 py-1 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/30"
                }
                key={tag}
                onClick={() => toggleTag(tag)}
                type="button"
              >
                {tag}
                <span className={isSelected ? "text-cyan-200/80" : "text-slate-500"}>{count}</span>
              </button>
            );
          })}

          {selectedTags.length > 0 ? (
            <button
              className="text-xs font-semibold text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("tags");
                setSearchParams(next, { replace: true });
              }}
              type="button"
            >
              Clear tags
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={projectId ? "grid gap-5" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start"}
        hidden={view === "graph" && !projectId}
      >
      <div
        aria-labelledby={`brainstorm-filter-${activeFilter}`}
        className="grid gap-5"
        id="brainstorm-filter-results"
        role="tabpanel"
      >
        {notesQuery.isPending ? <EmptyState isLoading title="Loading signals" message="Fetching saved notes." /> : null}

        {notesQuery.isError ? (
          <EmptyState title="Could not load notes" message={notesQuery.error.message} />
        ) : null}

        {noteTaskMessage ? (
          <InlineAlert tone="success">
            {noteTaskMessage}
          </InlineAlert>
        ) : null}

        {createTaskFromNoteMutation.isError ? (
          <InlineAlert tone="error">
            {createTaskFromNoteMutation.error.message}
          </InlineAlert>
        ) : null}

        {!notesQuery.isPending && !notesQuery.isError && notes.length === 0 ? (
          <EmptyState
            action={
              <button
                className="orbit-button-tertiary"
                onClick={openCreateModal}
                type="button"
              >
                <Plus size={16} />
                Capture note
              </button>
            }
            title="No signals captured"
            message="Capture the first note for this orbit."
            illustration="brainstorm"
          />
        ) : null}

        {!notesQuery.isPending && !notesQuery.isError && notes.length > 0 && filteredNotes.length === 0 ? (
          <EmptyState title="No matching signals" message="Choose another note type to keep scanning." />
        ) : null}

        {!notesQuery.isPending && !notesQuery.isError && filteredNotes.length > 0 ? (
          <ul className="grid gap-3">
            {filteredNotes.map((note) => (
              <li
                className={clsx(
                  "orbit-panel rounded-lg p-4 transition",
                  highlightedNoteId === note.id && "ring-2 ring-cyan-300/60",
                )}
                key={note.id}
                ref={(element) => {
                  if (element) noteRefs.current.set(note.id, element);
                  else noteRefs.current.delete(note.id);
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-sm font-semibold text-white">{note.title}</h2>
                      <StatusPill>{noteTypeLabel(note.note_type)}</StatusPill>
                    </div>
                    {note.body ? (
                      <div className="orbit-prose mt-2 text-sm text-slate-400">
                        <LinkedText body={note.body} />
                      </div>
                    ) : null}
                  </div>
                  <time className="shrink-0 text-xs text-cyan-100" dateTime={note.updated_at}>
                    {new Date(note.updated_at).toLocaleDateString()}
                  </time>
                </div>
                {projectId ? (
                  <div className="mt-3 flex justify-end">
                    <button
                      aria-label={`Create task from ${note.title}`}
                      className="orbit-button-secondary px-3 py-1.5 text-xs"
                      disabled={createTaskFromNoteMutation.isPending}
                      onClick={() => {
                        setNoteTaskMessage("");
                        createTaskFromNoteMutation.mutate(note);
                      }}
                      type="button"
                    >
                      Create task
                    </button>
                  </div>
                ) : null}
                {note.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <button
                        aria-pressed={selectedTags.includes(tag.toLowerCase())}
                        className={
                          selectedTags.includes(tag.toLowerCase())
                            ? "rounded-full border border-cyan-300/40 bg-cyan-300/15 px-2 py-0.5 text-xs font-semibold text-cyan-100"
                            : "rounded-full border border-slate-400/20 bg-slate-400/10 px-2 py-0.5 text-xs font-semibold text-slate-300 hover:border-cyan-300/30"
                        }
                        key={tag}
                        onClick={() => toggleTag(tag.toLowerCase())}
                        type="button"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

        {!projectId ? (
          <aside aria-label="Orbit insights" className="surface-quiet grid gap-4 rounded-xl p-5">
            <h2 className="mission-label">Orbit insights</h2>
            {brainstormInsights.map((insight) => (
              <div key={insight.title}>
                <p className="text-sm font-semibold text-white">{insight.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{insight.body}</p>
              </div>
            ))}
            <img
              alt=""
              aria-hidden
              className="mx-auto h-auto w-full max-w-40 opacity-80"
              src={orbitAssets.illustrations.emptyBrainstorm}
            />
            <p className="text-center text-xs text-slate-500">Your orbit is ready for new signals.</p>
          </aside>
        ) : null}
      </div>

      {!projectId ? (
        <p className="text-center text-xs text-slate-500">
          Private to you. Your signals stay in your orbit.
        </p>
      ) : null}

      {isCreateOpen ? (
        <Modal title="Capture note" onClose={() => setIsCreateOpen(false)}>
          <NoteForm
            isSubmitting={createNoteMutation.isPending}
            onSubmit={(values) => createNoteMutation.mutate(values)}
          />
          {createNoteMutation.isError ? (
            <p className="mt-3 text-sm text-violet-100">{createNoteMutation.error.message}</p>
          ) : null}
        </Modal>
      ) : null}
    </section>
  );
}
