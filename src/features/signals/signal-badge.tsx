import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase/client";
import { useWorkspaceId } from "../workspaces/workspace-context";
import {
  countUnreadSignals,
  unreadByWorkspaceQueryKey,
  unreadCountsByWorkspace,
  unreadSignalCountQueryKey,
} from "./signals.queries";

/** Only callable inside a WorkspaceProvider: useWorkspaceId throws otherwise. */
export function useUnreadSignalCount(): number {
  const workspaceId = useWorkspaceId();

  const query = useQuery({
    queryKey: unreadSignalCountQueryKey(workspaceId),
    queryFn: () => countUnreadSignals(supabase, workspaceId),
  });

  return query.data ?? 0;
}

/** Feeds the switcher dot; deliberately not workspace-scoped, so it must not call useWorkspaceId. */
export function useUnreadByWorkspace(): Map<string, number> {
  const query = useQuery({
    queryKey: unreadByWorkspaceQueryKey,
    queryFn: () => unreadCountsByWorkspace(supabase),
  });

  return query.data ?? new Map();
}

export function SignalCountBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span
      aria-label={`${count} unread`}
      // Violet, not cyan: cyan is reserved for interactive affordances, and
      // unread is a state rather than one.
      className="ml-auto shrink-0 rounded-full bg-violet-400/20 px-1.5 py-0.5 text-[0.65rem] font-semibold text-violet-100"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
