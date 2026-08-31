import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Field } from "../../components/field";
import { Modal } from "../../components/modal";
import { supabase } from "../../lib/supabase/client";
import { useUnreadByWorkspace } from "../signals/signal-badge";
import { useWorkspaceId } from "./workspace-context";
import { workspacePath } from "./workspace-path";
import { createWorkspace, listWorkspaces, workspacesQueryKey } from "./workspaces.queries";

export function WorkspaceSwitcher({ isCollapsed }: { isCollapsed: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const workspacesQuery = useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => listWorkspaces(supabase),
  });
  const unreadByWorkspace = useUnreadByWorkspace();

  const workspaces = workspacesQuery.data ?? [];
  const current = workspaces.find((workspace) => workspace.id === workspaceId);
  // Falling back keeps the trigger labelled while the list loads or if it
  // fails, rather than collapsing to an empty button.
  const currentName = current?.name ?? "Workspace";

  const createMutation = useMutation({
    mutationFn: (workspaceName: string) => createWorkspace(supabase, workspaceName),
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      setIsCreateOpen(false);
      setName("");
      navigate(workspacePath(id, "/"));
    },
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function choose(id: string) {
    setIsOpen(false);
    // Always the workspace root: ids in the current path belong to the
    // workspace being left.
    navigate(workspacePath(id, "/"));
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(name);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={isCollapsed ? currentName : undefined}
        className={`flex w-full min-w-0 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#050d20]/80 px-2.5 py-2 text-left text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 ${
          isCollapsed ? "justify-center" : ""
        }`}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-cyan-300/15 text-xs font-black text-cyan-100">
          {currentName.slice(0, 1).toUpperCase()}
        </span>
        {isCollapsed ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">{currentName}</span>
            <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
          </>
        )}
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 grid gap-0.5 rounded-lg border border-white/[0.08] bg-[#050d20] p-1 shadow-xl"
          role="menu"
        >
          {workspaces.map((workspace) => (
            <button
              className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-200 transition hover:bg-white/[0.05]"
              key={workspace.id}
              onClick={() => choose(workspace.id)}
              role="menuitem"
              type="button"
            >
              <span className="w-4 shrink-0">
                {workspace.id === workspaceId ? (
                  <Check aria-hidden="true" className="h-4 w-4 text-cyan-300" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id !== workspaceId && (unreadByWorkspace.get(workspace.id) ?? 0) > 0 ? (
                <>
                  {" "}
                  <span
                    aria-label="Unread signals"
                    // Violet, not cyan: unread is a state, not an interactive affordance.
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300"
                  />
                </>
              ) : null}
            </button>
          ))}

          <div className="my-0.5 h-px bg-white/[0.08]" />

          <button
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-cyan-200 transition hover:bg-white/[0.05]"
            onClick={() => {
              setIsOpen(false);
              setIsCreateOpen(true);
            }}
            role="menuitem"
            type="button"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            New workspace
          </button>
        </div>
      ) : null}

      {isCreateOpen ? (
        <Modal onClose={() => setIsCreateOpen(false)} size="sm" title="New workspace">
          <form className="grid gap-4" onSubmit={submitCreate}>
            <Field label="Workspace name">
              <input
                autoFocus
                className="orbit-input"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </Field>

            {createMutation.isError ? (
              <p
                className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
                role="alert"
              >
                {createMutation.error.message}
              </p>
            ) : null}

            <button className="orbit-button w-full" disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? "Creating..." : "Create workspace"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
