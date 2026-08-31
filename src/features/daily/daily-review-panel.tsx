import { DataRow, QuietPanel, SectionHeader } from "../../components/minimal-layout";
import type { Database } from "../../lib/supabase/database.types";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { calculateDailyPlanSummary } from "./daily-plan.utils";

type Capture = Database["public"]["Tables"]["captures"]["Row"];

type DailyReviewPanelProps = {
  captures: Capture[];
  items: DailyPlanItemWithWorkItem[];
};

export function DailyReviewPanel({ captures, items }: DailyReviewPanelProps) {
  const summary = calculateDailyPlanSummary(items);

  return (
    <QuietPanel>
      <p className="mission-label">Mission Debrief</p>
      <SectionHeader title="Review">
        {summary.completed} completed, {summary.skipped} skipped, {summary.planned} still planned.
      </SectionHeader>

      <label className="mt-4 grid gap-1 text-sm">
        <span className="font-medium text-slate-200">What moved forward?</span>
        <textarea className="orbit-input min-h-28" placeholder="Write a short mission reflection" />
      </label>

      {captures.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-white">Captured signals</h3>
          <ul className="mt-2">
            {captures.map((capture) => (
              <li key={capture.id}>
                <DataRow className="daily-capture-dock" title={capture.title} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </QuietPanel>
  );
}
