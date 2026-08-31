import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { PageHeader, QuietPanel, SectionHeader } from "../../components/minimal-layout";
import { StatusPill } from "../../components/status-pill";
import { supabase } from "../../lib/supabase/client";
import { BacklinksPanel } from "../links/backlinks-panel";
import { LinkedText } from "../links/linked-text";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";
import { loadMilestone, milestoneQueryKey } from "./milestone.queries";

export function MilestonePage() {
  const workspaceId = useWorkspaceId();
  const { milestoneId } = useParams<{ milestoneId: string }>();

  const milestoneQuery = useQuery({
    queryKey: milestoneQueryKey(workspaceId, milestoneId ?? ""),
    queryFn: () => loadMilestone(supabase, { workspaceId, milestoneId: milestoneId ?? "" }),
    enabled: Boolean(milestoneId),
  });

  const milestone = milestoneQuery.data;

  if (milestoneQuery.isError) {
    return <EmptyState message={milestoneQuery.error.message} title="Could not load the milestone" />;
  }

  if (!milestoneQuery.isPending && !milestone) {
    return (
      <EmptyState
        message="It may have been deleted, or you may not have access to it."
        title="Milestone not found"
      />
    );
  }

  if (!milestone) return null;

  const isComplete = Boolean(milestone.completedAt);

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={milestone.projectName ?? undefined} title={milestone.title}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={isComplete ? "good" : "neutral"}>{isComplete ? "Complete" : "Planned"}</StatusPill>
          {milestone.targetDate ? <StatusPill>Target {milestone.targetDate}</StatusPill> : null}
        </div>
      </PageHeader>

      <div>
        <Link
          className="orbit-button-secondary inline-flex items-center gap-1.5"
          to={workspacePath(workspaceId, `/projects/${milestone.projectId}`)}
        >
          Open in project
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      {milestone.description ? (
        <QuietPanel aria-label="Description">
          <LinkedText body={milestone.description} />
        </QuietPanel>
      ) : null}

      <section className="grid gap-2">
        <SectionHeader title="Tasks" />
        {milestone.tasks.length === 0 ? (
          <p className="text-sm text-slate-400">No tasks are linked to this milestone yet.</p>
        ) : (
          <QuietPanel aria-label="Tasks">
            <ul className="grid gap-1.5">
              {milestone.tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    className="block rounded-lg border border-slate-400/10 bg-white/[0.02] px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/30"
                    to={workspacePath(workspaceId, `/projects?task=${task.id}`)}
                  >
                    {task.title}
                  </Link>
                </li>
              ))}
            </ul>
          </QuietPanel>
        )}
      </section>

      <BacklinksPanel id={milestone.id} kind="milestone" />
    </div>
  );
}
