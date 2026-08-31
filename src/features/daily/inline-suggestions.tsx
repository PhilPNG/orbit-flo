import { clsx } from "clsx";
import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Database } from "../../lib/supabase/database.types";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { getSuggestedDailyWorkItems } from "./daily-plan.utils";
import { SuggestedFlightPlan } from "./suggested-flight-plan";

type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

type InlineSuggestionsProps = {
  availableWorkItems: WorkItem[];
  dailyPlanItems: DailyPlanItemWithWorkItem[];
  defaultExpanded?: boolean;
  isAdding: boolean;
  onAdd: (workItem: WorkItem, index: number) => void;
  projectNamesById?: Record<string, string>;
  todayKey: string;
};

export function InlineSuggestions({
  availableWorkItems,
  dailyPlanItems,
  defaultExpanded = false,
  isAdding,
  onAdd,
  projectNamesById = {},
  todayKey,
}: InlineSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const count = getSuggestedDailyWorkItems(availableWorkItems, dailyPlanItems, todayKey).length;

  if (count === 0) return null;

  const countLabel = `${count} suggestion${count === 1 ? "" : "s"} for today`;

  return (
    <div>
      <button
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Hide suggestions" : countLabel}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 transition hover:text-cyan-100"
        onClick={() => setIsExpanded((current) => !current)}
        type="button"
      >
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{countLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={clsx("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")}
        />
      </button>
      {isExpanded ? (
        <div className="mt-2">
          <SuggestedFlightPlan
            availableWorkItems={availableWorkItems}
            dailyPlanItems={dailyPlanItems}
            isAdding={isAdding}
            onAdd={onAdd}
            projectNamesById={projectNamesById}
            todayKey={todayKey}
          />
        </div>
      ) : null}
    </div>
  );
}
