import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase/client";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";
import { backlinksQueryKey, listBacklinks } from "./note-links.queries";
import type { LinkKind } from "./orbit-link";

export function BacklinksPanel({ kind, id }: { kind: LinkKind; id: string }) {
  const workspaceId = useWorkspaceId();

  const backlinksQuery = useQuery({
    queryKey: backlinksQueryKey(workspaceId, kind, id),
    queryFn: () => listBacklinks(supabase, { workspaceId, kind, id }),
    enabled: Boolean(id),
  });

  const backlinks = backlinksQuery.data ?? [];

  // Backlinks supplement whatever screen hosts them, so nothing to show and
  // a failure to load both render as nothing rather than as noise.
  if (backlinks.length === 0) return null;

  return (
    <section aria-label="Linked from" className="grid gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Link2 aria-hidden="true" className="h-4 w-4 text-slate-500" />
        Linked from
      </h3>
      <ul className="grid gap-1.5">
        {backlinks.map((backlink) => (
          <li key={backlink.id}>
            <Link
              className="flex items-center gap-2 rounded-lg border border-slate-400/10 bg-white/[0.02] px-3 py-2 transition hover:border-cyan-300/30"
              to={workspacePath(workspaceId, `/notes?note=${backlink.id}`)}
            >
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {backlink.noteType}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-cyan-200">
                {backlink.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
