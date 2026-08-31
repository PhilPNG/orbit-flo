import { ClipboardList, Lightbulb, Satellite } from "lucide-react";
import { DataRow, QuietPanel, SectionHeader } from "../../components/minimal-layout";
import type { Database } from "../../lib/supabase/database.types";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

type Capture = Database["public"]["Tables"]["captures"]["Row"];

type TimelineEvent = {
  id: string;
  timestamp: string;
  title: string;
  label: string;
  tone: "cyan" | "violet";
};

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function TodayTimeline({
  captures,
  items,
}: {
  captures: Capture[];
  items: DailyPlanItemWithWorkItem[];
}) {
  const events: TimelineEvent[] = [
    ...items.map((item) => ({
      id: `plan-${item.id}`,
      label: item.is_primary ? "Primary burn" : "Planned",
      timestamp: item.created_at,
      title: item.workItem?.title ?? "Unlinked objective",
      tone: "cyan" as const,
    })),
    ...captures.map((capture) => ({
      id: `capture-${capture.id}`,
      label: capture.type,
      timestamp: capture.created_at,
      title: capture.title,
      tone: "violet" as const,
    })),
  ].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  return (
    <QuietPanel>
      <SectionHeader
        action={<Satellite aria-hidden="true" className="mt-1 h-4 w-4 text-cyan-200" />}
        title="Today Timeline"
      />

      {events.length > 0 ? (
        <ol className="mt-4">
          {events.map((event) => (
            <li key={event.id}>
              <DataRow
                action={
                  <span
                    className={
                      event.tone === "cyan"
                        ? "grid h-8 w-8 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                        : "grid h-8 w-8 place-items-center rounded-full border border-violet-300/25 bg-violet-300/10 text-violet-100"
                    }
                  >
                    {event.tone === "cyan" ? (
                      <ClipboardList aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Lightbulb aria-hidden="true" className="h-4 w-4" />
                    )}
                  </span>
                }
                title={event.title}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase text-slate-500">{formatTime(event.timestamp)}</span>
                  <span className="rounded-full border border-slate-400/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase text-slate-300">
                    {event.label}
                  </span>
                </div>
              </DataRow>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-400/20 px-4 py-5 text-center text-sm text-slate-400">
          Plan a task or dock a signal to build today&apos;s timeline.
        </p>
      )}
    </QuietPanel>
  );
}
