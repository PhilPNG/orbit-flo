import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { useAuth } from "../auth/use-auth";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { backlinksQueryKey } from "./note-links.queries";
import type { LinkKind } from "./orbit-link";
import {
  linkMention,
  listUnlinkedMentions,
  unlinkedMentionsQueryKey,
} from "./unlinked-mentions.queries";

/**
 * Notes that name this thing without linking it. Sits below the backlinks so
 * confirmed links read first and these are clearly the weaker signal.
 */
export function MentionsPanel({ kind, id, title }: { kind: LinkKind; id: string; title: string }) {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();

  const mentionsQuery = useQuery({
    queryKey: unlinkedMentionsQueryKey(workspaceId, kind, id),
    queryFn: () => listUnlinkedMentions(supabase, { kind, id }),
    enabled: Boolean(id),
  });

  const linkMutation = useMutation({
    mutationFn: (noteId: string) =>
      linkMention(supabase, {
        workspaceId,
        userId: user?.id ?? "",
        noteId,
        title,
        kind,
        id,
      }),
    onSuccess: async () => {
      // The mention becomes a backlink, so both lists change.
      await queryClient.invalidateQueries({
        queryKey: unlinkedMentionsQueryKey(workspaceId, kind, id),
      });
      await queryClient.invalidateQueries({ queryKey: backlinksQueryKey(workspaceId, kind, id) });
    },
  });

  const mentions = mentionsQuery.data ?? [];

  // Supplementary to whatever screen hosts it: nothing found and a failure to
  // load both render as nothing rather than as noise.
  if (mentions.length === 0) return null;

  return (
    <section aria-label="Unlinked mentions" className="grid gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Sparkles aria-hidden="true" className="h-4 w-4 text-slate-500" />
        Mentioned, not linked
      </h3>

      <ul className="grid gap-1.5">
        {mentions.map((mention) => (
          <li
            className="flex items-center gap-2.5 rounded-lg border border-slate-400/10 bg-white/[0.02] px-3 py-2"
            key={mention.id}
          >
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {mention.noteType}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{mention.title}</span>
            <button
              aria-label={`Link ${mention.title}`}
              className="orbit-button-secondary shrink-0 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={linkMutation.isPending}
              onClick={() => linkMutation.mutate(mention.id)}
              type="button"
            >
              Link it
            </button>
          </li>
        ))}
      </ul>

      {linkMutation.isError ? (
        <p className="text-sm text-rose-200" role="alert">
          {linkMutation.error.message}
        </p>
      ) : null}
    </section>
  );
}
