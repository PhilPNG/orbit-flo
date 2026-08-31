import { QuietPanel } from "../../components/minimal-layout";
import { OrbitProgressRing } from "../../components/space-visuals";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { calculateDailyPlanSummary } from "./daily-plan.utils";

export function MissionMomentum({ items }: { items: DailyPlanItemWithWorkItem[] }) {
  const summary = calculateDailyPlanSummary(items);

  return (
    <QuietPanel>
      <p className="mission-label">Mission Momentum</p>
      <div className="mt-4 flex flex-col items-center gap-3">
        <OrbitProgressRing label="Today" value={summary.completionPercent} />
        <p className="text-sm font-semibold text-white">{summary.completionPercent}% complete</p>
        <dl className="grid w-full grid-cols-3 gap-2 border-t border-slate-400/12 pt-3 text-center">
          <div>
            <dt className="text-[0.65rem] font-bold uppercase text-slate-400">Done</dt>
            <dd className="mt-1 text-lg font-black text-white">{summary.completed}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase text-slate-400">Planned</dt>
            <dd className="mt-1 text-lg font-black text-white">{summary.planned}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] font-bold uppercase text-slate-400">Skipped</dt>
            <dd className="mt-1 text-lg font-black text-white">{summary.skipped}</dd>
          </div>
        </dl>
      </div>
    </QuietPanel>
  );
}
