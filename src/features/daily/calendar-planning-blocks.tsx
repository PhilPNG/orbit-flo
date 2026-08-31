import { CalendarDays } from "lucide-react";

type PlanningBlockId = "morning" | "afternoon" | "evening";

const planningBlocks: Array<{
  id: PlanningBlockId;
  label: string;
  copy: string;
  window: string;
}> = [
  {
    id: "morning",
    label: "Morning",
    copy: "High-clarity launch work",
    window: "AM",
  },
  {
    id: "afternoon",
    label: "Afternoon",
    copy: "Meetings, reviews, shipping",
    window: "PM",
  },
  {
    id: "evening",
    label: "Evening",
    copy: "Light cleanup and capture",
    window: "Late",
  },
];

export function CalendarPlanningBlocks({
  onPlanWorkItem,
}: {
  onPlanWorkItem: (workItemId: string, blockId: PlanningBlockId, index: number) => void;
}) {
  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-blue-300/25 bg-blue-300/10 text-blue-100">
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
        </span>
        <div>
          <p className="mission-label">Plan from calendar</p>
          <h2 className="text-base font-black text-white">Planning blocks</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {planningBlocks.map((block, index) => (
          <div
            aria-label={`${block.label} planning block`}
            className="min-h-28 rounded-lg border border-dashed border-cyan-300/25 bg-slate-950/35 p-3 transition hover:border-cyan-300/55 hover:bg-cyan-300/10"
            key={block.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const workItemId = event.dataTransfer.getData("text/plain");
              if (workItemId) onPlanWorkItem(workItemId, block.id, index);
            }}
          >
            <span className="rounded-full border border-slate-400/15 px-2 py-0.5 text-[0.7rem] font-bold uppercase text-slate-400">
              {block.window}
            </span>
            <p className="mt-3 text-sm font-black text-white">{block.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{block.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
