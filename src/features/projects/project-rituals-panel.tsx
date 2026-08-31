import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ClipboardCheck, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { InlineAlert } from "../../components/inline-alert";
import { supabase } from "../../lib/supabase/client";
import {
  createProjectRitual,
  deleteProjectRitual,
  ensureDefaultProjectRituals,
  projectRitualsKeys,
  renameProjectRitual,
  toggleProjectRitual,
} from "./project-rituals.queries";

export function ProjectRitualsPanel({
  workspaceId,
  projectId,
  userId,
  ritualsTitle,
  onRenameTitle,
  onHide,
}: {
  workspaceId: string;
  projectId: string;
  userId: string;
  ritualsTitle: string | null;
  onRenameTitle: (title: string) => void;
  onHide: () => void;
}) {
  const queryClient = useQueryClient();
  const listKey = projectRitualsKeys.list(workspaceId, projectId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingRitualId, setEditingRitualId] = useState<string | null>(null);
  const [ritualDraft, setRitualDraft] = useState("");
  const [newRitual, setNewRitual] = useState("");

  const ritualsQuery = useQuery({
    queryKey: listKey,
    queryFn: () => ensureDefaultProjectRituals(supabase, { workspaceId, projectId, userId }),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: listKey });
  };

  const createMutation = useMutation({
    mutationFn: (input: { title: string; sortOrder: number }) =>
      createProjectRitual(supabase, { workspaceId, projectId, userId, title: input.title, sortOrder: input.sortOrder }),
    onSuccess: async () => {
      setNewRitual("");
      await invalidate();
    },
  });
  const renameMutation = useMutation({
    mutationFn: (input: { id: string; title: string }) =>
      renameProjectRitual(supabase, { id: input.id, workspaceId, title: input.title }),
    onSuccess: invalidate,
  });
  const toggleMutation = useMutation({
    mutationFn: (input: { id: string; isDone: boolean }) =>
      toggleProjectRitual(supabase, { id: input.id, workspaceId, isDone: input.isDone }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProjectRitual(supabase, { id, workspaceId }),
    onSuccess: invalidate,
  });

  const rituals = ritualsQuery.data ?? [];
  const checkedCount = rituals.filter((ritual) => ritual.is_done).length;
  const displayTitle = ritualsTitle?.trim() ? ritualsTitle : "Operating cadence";

  function commitTitle() {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== displayTitle) onRenameTitle(trimmed);
  }

  function commitRitualRename(id: string) {
    setEditingRitualId(null);
    const trimmed = ritualDraft.trim();
    if (trimmed) renameMutation.mutate({ id, title: trimmed });
  }

  function submitNewRitual() {
    const trimmed = newRitual.trim();
    if (!trimmed) return;
    createMutation.mutate({ title: trimmed, sortOrder: rituals.length });
  }

  return (
    <div className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-violet-300/25 bg-violet-300/10 text-violet-100">
            <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="mission-label">Project rituals</p>
            {isEditingTitle ? (
              <input
                aria-label="Rituals section title"
                autoFocus
                className="orbit-input mt-0.5 px-2 py-1 text-sm"
                onBlur={commitTitle}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitTitle();
                  }
                  if (event.key === "Escape") setIsEditingTitle(false);
                }}
                value={titleDraft}
              />
            ) : (
              <button
                aria-label="Rename rituals section"
                className="block truncate text-left text-base font-black text-white hover:text-cyan-100"
                onClick={() => {
                  setTitleDraft(displayTitle);
                  setIsEditingTitle(true);
                }}
                type="button"
              >
                {displayTitle}
              </button>
            )}
          </div>
        </div>
        <button
          aria-label="Hide rituals"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          onClick={onHide}
          type="button"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>

      {ritualsQuery.isError ? (
        <div className="mt-3">
          <InlineAlert tone="error">{ritualsQuery.error.message}</InlineAlert>
        </div>
      ) : null}

      <p className="mt-3 text-sm font-semibold text-cyan-100">
        {checkedCount}/{rituals.length} rituals checked
      </p>

      <div className="mt-3 grid gap-2">
        {rituals.map((ritual) => (
          <div className="group flex items-center gap-2" key={ritual.id}>
            <input
              aria-label={ritual.title}
              checked={ritual.is_done}
              className="h-4 w-4 accent-cyan-300"
              onChange={() => toggleMutation.mutate({ id: ritual.id, isDone: !ritual.is_done })}
              type="checkbox"
            />
            {editingRitualId === ritual.id ? (
              <input
                aria-label="Ritual title"
                autoFocus
                className="orbit-input flex-1 px-2 py-1 text-sm"
                onBlur={() => commitRitualRename(ritual.id)}
                onChange={(event) => setRitualDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRitualRename(ritual.id);
                  }
                  if (event.key === "Escape") setEditingRitualId(null);
                }}
                value={ritualDraft}
              />
            ) : (
              <button
                className={clsx(
                  "flex-1 truncate text-left text-sm font-semibold",
                  ritual.is_done ? "text-slate-500 line-through" : "text-slate-200 hover:text-cyan-100",
                )}
                onClick={() => {
                  setEditingRitualId(ritual.id);
                  setRitualDraft(ritual.title);
                }}
                type="button"
              >
                {ritual.title}
              </button>
            )}
            <button
              aria-label={`Delete ${ritual.title}`}
              className="text-slate-600 opacity-0 transition hover:text-rose-200 group-hover:opacity-100"
              onClick={() => deleteMutation.mutate(ritual.id)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          aria-label="New ritual"
          className="orbit-input flex-1 px-2.5 py-1.5 text-sm"
          onChange={(event) => setNewRitual(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitNewRitual();
            }
          }}
          placeholder="Add a ritual — Enter to save"
          value={newRitual}
        />
        <button
          aria-label="Add ritual"
          className="orbit-button-secondary grid h-8 w-8 shrink-0 place-items-center p-0"
          disabled={createMutation.isPending || !newRitual.trim()}
          onClick={submitNewRitual}
          type="button"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
