import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { PageHeader, QuietPanel } from "../../components/minimal-layout";
import { supabase } from "../../lib/supabase/client";
import { MemberAvatar } from "../profiles/member-avatar";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";
import { buildSignalSentence } from "./signal-sentence";
import {
  countUnreadSignals,
  listSignals,
  markAllSignalsRead,
  markSignalRead,
  signalsQueryKey,
  unreadByWorkspaceQueryKey,
  unreadSignalCountQueryKey,
  type Signal,
} from "./signals.queries";

function targetPath(workspaceId: string, signal: Signal): string | null {
  if (signal.workItemId) return workspacePath(workspaceId, `/projects?task=${signal.workItemId}`);
  if (signal.noteId) return workspacePath(workspaceId, `/notes?note=${signal.noteId}`);
  return null;
}

export function SignalsPage() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const signalsQuery = useQuery({
    queryKey: signalsQueryKey(workspaceId),
    queryFn: () => listSignals(supabase, workspaceId),
  });

  // The list is capped at 50 rows, but unread count is not — deriving unread
  // by filtering the (capped) list disagrees with the nav badge, which counts
  // every unread row, once there are more than 50 signals. Query the same
  // count the badge uses so both agree, and so "Mark all read" still appears
  // whenever the badge says there's something to clear.
  const unreadCountQuery = useQuery({
    queryKey: unreadSignalCountQueryKey(workspaceId),
    queryFn: () => countUnreadSignals(supabase, workspaceId),
  });

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: signalsQueryKey(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: unreadSignalCountQueryKey(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: unreadByWorkspaceQueryKey }),
    ]);
  }

  const readMutation = useMutation({
    mutationFn: (id: string) => markSignalRead(supabase, { id }),
    onSuccess: refresh,
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllSignalsRead(supabase, { workspaceId }),
    onSuccess: refresh,
  });

  const signals = signalsQuery.data ?? [];
  const unread = unreadCountQuery.data ?? 0;

  return (
    <div className="grid gap-6">
      <PageHeader title="Signals">What happened while you were away.</PageHeader>

      {signalsQuery.isError ? (
        <p className="text-sm text-rose-200" role="alert">
          {signalsQuery.error.message}
        </p>
      ) : null}

      {unread > 0 ? (
        <div>
          <button
            className="orbit-button-secondary"
            disabled={readAllMutation.isPending}
            onClick={() => readAllMutation.mutate()}
            type="button"
          >
            Mark all read
          </button>
        </div>
      ) : null}

      {signals.length === 0 && !signalsQuery.isPending ? (
        <EmptyState
          title="Nothing yet"
          message="When someone assigns you a task, comments on your work or mentions you, it lands here."
        />
      ) : (
        <QuietPanel aria-label="Signals">
          <ul className="grid gap-1.5">
            {signals.map((signal) => {
              const path = targetPath(workspaceId, signal);
              const sentence = buildSignalSentence({
                kind: signal.kind,
                actorName: signal.actorName,
                targetTitle: signal.targetTitle,
              });

              return (
                <li
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                    signal.readAt === null
                      ? // Not cyan: cyan means interactive in this design language,
                        // and unread is a state rather than an affordance.
                        "border-violet-300/25 bg-violet-400/[0.07]"
                      : "border-slate-400/10 bg-white/[0.02]"
                  }`}
                  key={signal.id}
                >
                  <MemberAvatar
                    displayName={signal.actorName ?? "Someone"}
                    size="sm"
                    // actor_id is `on delete set null`, so a departed colleague
                    // leaves this null — fall back to a fixed id rather than
                    // signal.id, which made the same person a different colour
                    // on every row.
                    userId={signal.actorId ?? "unknown-actor"}
                  />
                  <span className="min-w-0 flex-1 text-sm text-slate-200">
                    {path ? (
                      <Link className="hover:text-white" onClick={() => readMutation.mutate(signal.id)} to={path}>
                        {sentence}
                      </Link>
                    ) : (
                      sentence
                    )}
                  </span>
                  {signal.readAt === null ? (
                    <span aria-label="Unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-300" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </QuietPanel>
      )}
    </div>
  );
}
