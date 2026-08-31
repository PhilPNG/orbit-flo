import { clsx } from "clsx";
import { CheckCircle2, Circle, Flame, Sparkles, SkipForward } from "lucide-react";
import type { DragEvent } from "react";
import { EmptyState } from "../../components/empty-state";
import { DataRow, QuietPanel, SectionHeader } from "../../components/minimal-layout";
import { StatusPill } from "../../components/status-pill";
import { toPlainText } from "../links/plain-text";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";

type FlightPlanProps = {
  completedItemTitle?: string;
  isUpdating: boolean;
  items: DailyPlanItemWithWorkItem[];
  onComplete: (id: string) => void;
  onDropWorkItemId?: (workItemId: string) => void;
  onPullSuggested?: () => void;
  onSkip: (id: string) => void;
  onUndoComplete?: () => void;
  suggestedCount?: number;
};

function stateTone(state: DailyPlanItemWithWorkItem["state"]) {
  if (state === "completed") return "good";
  if (state === "skipped") return "warning";
  return "neutral";
}

export function FlightPlan({
  completedItemTitle,
  isUpdating,
  items,
  onComplete,
  onDropWorkItemId,
  onPullSuggested,
  onSkip,
  onUndoComplete,
  suggestedCount = 0,
}: FlightPlanProps) {
  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const workItemId = event.dataTransfer.getData("text/plain");
    if (workItemId) onDropWorkItemId?.(workItemId);
  }

  const completionToast = completedItemTitle ? (
    <div className="daily-completion-flare orbit-launch-completion mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100">
      <span>{completedItemTitle} completed. Momentum updated.</span>
      {onUndoComplete ? (
        <button
          aria-label="Undo completed objective"
          className="rounded-md border border-emerald-200/30 px-2 py-1 text-xs font-bold text-emerald-50 hover:bg-emerald-200/10"
          onClick={onUndoComplete}
          type="button"
        >
          Undo
        </button>
      ) : null}
    </div>
  ) : null;

  if (items.length === 0) {
    return (
      <QuietPanel
        aria-label="Drop tasks into today's plan"
        className="today-flight-target"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {completionToast}
        <EmptyState
          action={
            suggestedCount > 0 && onPullSuggested ? (
              <button className="orbit-button" onClick={onPullSuggested} type="button">
                <Sparkles size={16} aria-hidden="true" />
                Add top suggested task
              </button>
            ) : null
          }
          className="today-flight-empty"
          illustration="today"
          title="No objectives locked"
          message={
            suggestedCount > 0
              ? "Pull in a smart suggestion or drag a task here to start today's orbit."
              : "Add 3-5 objectives to give today a clean orbit."
          }
        />
      </QuietPanel>
    );
  }

  return (
    <QuietPanel
      aria-label="Drop tasks into today's plan"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <SectionHeader action={<StatusPill tone="good">{items.length}</StatusPill>} title="Flight plan" />
      {completionToast}

      <ul className="mt-4">
        {items.map((item) => {
          const actionsDisabled = isUpdating || item.state === "completed" || item.state === "skipped";

          return (
            <li className="group" key={item.id}>
              <DataRow
                className={clsx("py-4 [&>div>p]:text-base", item.is_primary && "daily-orbit-pulse")}
                action={
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={`Complete ${item.workItem?.title ?? "daily plan item"}`}
                      className="orbit-button-secondary grid h-9 w-9 place-items-center p-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      disabled={actionsDisabled}
                      onClick={() => onComplete(item.id)}
                      type="button"
                    >
                      {item.state === "completed" ? (
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Circle aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      aria-label={`Skip ${item.workItem?.title ?? "daily plan item"}`}
                      className="orbit-button-secondary grid h-9 w-9 place-items-center p-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      disabled={actionsDisabled}
                      onClick={() => onSkip(item.id)}
                      type="button"
                    >
                      <SkipForward aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                }
                title={item.workItem?.title ?? "Missing work item"}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {item.is_primary ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-xs font-semibold text-cyan-100">
                      <Flame aria-hidden="true" className="h-3 w-3" />
                      Primary burn
                    </span>
                  ) : null}
                  <StatusPill tone={stateTone(item.state)}>{item.state}</StatusPill>
                </div>
                {item.workItem?.description ? (
                  <p className="mt-1 min-w-0 break-words">{toPlainText(item.workItem.description)}</p>
                ) : null}
              </DataRow>
            </li>
          );
        })}
      </ul>
    </QuietPanel>
  );
}
