import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClickSpark } from "./click-spark";
import { parseQuickAdd } from "../lib/quick-add";
import { supabase } from "../lib/supabase/client";
import { useAuth } from "../features/auth/use-auth";
import { createCapture } from "../features/daily/daily-plan.queries";
import { useWorkspaceId } from "../features/workspaces/workspace-context";

export function GlobalQuickAdd() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [value, setValue] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const quickAddMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Workspace and user are required for quick add.");

      const parsed = parseQuickAdd(value);
      return createCapture(supabase, {
        workspaceId,
        userId: user.id,
        type: parsed.type,
        title: parsed.title,
        body: parsed.body,
      });
    },
    onSuccess: async () => {
      setValue("");
      setSuccessMessage("Quick add docked.");
      await queryClient.invalidateQueries({ queryKey: ["inbox-captures", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["daily-mission-control"] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage("");
    if (!value.trim()) return;
    quickAddMutation.mutate();
  }

  return (
    <form className="grid w-full min-w-0 gap-2" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="global-quick-add">
        Quick add
      </label>
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="relative w-0 min-w-0 flex-1">
          <input
            className="orbit-input w-full border-white/[0.1] bg-[#020817]/60 px-3 py-2 pr-12 text-xs"
            disabled={quickAddMutation.isPending}
            id="global-quick-add"
            onChange={(event) => setValue(event.target.value)}
            placeholder="Quick add..."
            ref={inputRef}
            /* The default size of 20 characters gives the input a ~160px intrinsic
               width, which forces the sidebar dock wider than its own content box. */
            size={1}
            value={value}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/[0.12] px-1 py-0.5 text-[0.55rem] uppercase leading-none text-slate-400">
            Ctrl N
          </span>
        </div>
        <ClickSpark>
          <button
            aria-label="Dock quick add"
            className="orbit-button-secondary grid h-11 w-11 shrink-0 place-items-center border-white/[0.1] bg-white/[0.03] p-0 lg:h-9 lg:w-9"
            disabled={quickAddMutation.isPending || !value.trim()}
            type="submit"
          >
            <Send aria-hidden="true" className="h-4 w-4" />
          </button>
        </ClickSpark>
      </div>
      {successMessage ? <p className="text-xs font-semibold text-emerald-200">{successMessage}</p> : null}
      {quickAddMutation.isError ? (
        <p className="text-xs font-semibold text-rose-200">{quickAddMutation.error.message}</p>
      ) : null}
    </form>
  );
}
