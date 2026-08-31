import { CalendarClock, CheckCircle2, Flag } from "lucide-react";
import { EmptyState } from "../../components/empty-state";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import type { Database, ProjectPriority } from "../../lib/supabase/database.types";
import { toPlainText } from "../links/plain-text";
import { buildProjectTimelineEntries } from "./project-timeline.utils";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

function priorityTone(priority: ProjectPriority | null): StatusTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "good";
  return "neutral";
}

export function ProjectTimeline({
  milestones,
  workItems,
}: {
  milestones: Milestone[];
  workItems: WorkItem[];
}) {
  const entries = buildProjectTimelineEntries({ milestones, workItems });

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No timeline signals yet"
        message="Add deadlines or milestones to chart this project orbit."
      />
    );
  }

  return (
    <section className="orbit-panel rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <CalendarClock size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="mission-label">Launch sequence</p>
          <h2 className="text-xl font-black text-white">Project Timeline</h2>
        </div>
      </div>

      <ol className="relative mt-5 grid gap-3 before:absolute before:bottom-3 before:left-4 before:top-3 before:w-px before:bg-cyan-300/20">
        {entries.map((entry) => (
          <li className="relative grid gap-2 pl-10" key={`${entry.type}-${entry.id}`}>
            <span className="absolute left-0 top-1 grid h-8 w-8 place-items-center rounded-full border border-cyan-300/25 bg-slate-950 text-cyan-100">
              {entry.isComplete ? <CheckCircle2 size={15} aria-hidden="true" /> : <Flag size={15} aria-hidden="true" />}
            </span>
            <article className="orbit-panel-soft rounded-lg p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-sm font-semibold text-white">{entry.title}</h3>
                    <StatusPill>{entry.type}</StatusPill>
                    {entry.priority ? <StatusPill tone={priorityTone(entry.priority)}>{entry.priority}</StatusPill> : null}
                  </div>
                  {entry.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                      {toPlainText(entry.description, { preserveLineBreaks: true })}
                    </p>
                  ) : null}
                </div>
                <time className="shrink-0 text-xs font-bold uppercase text-cyan-100" dateTime={entry.date ?? undefined}>
                  {entry.date ?? "Unscheduled"}
                </time>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
