import { clsx } from "clsx";
import { CheckCircle2, Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DailyPlanItemWithWorkItem } from "./daily-plan.queries";
import { getPrimaryDailyItem } from "./daily-plan.utils";

type FocusSessionPanelProps = {
  isUpdating?: boolean;
  items: DailyPlanItemWithWorkItem[];
  onComplete?: (id: string) => void;
  onDropWorkItem?: (workItemId: string) => void;
  onSaveSessionNote?: (input: { title: string; body: string; workItemId?: string }) => void;
};

type FocusState = "idle" | "running" | "paused";

const focusDurations = [
  { label: "25m", minutes: 25 },
  { label: "50m", minutes: 50 },
] as const;

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function FocusSessionPanel({
  isUpdating = false,
  items,
  onComplete,
  onDropWorkItem,
  onSaveSessionNote,
}: FocusSessionPanelProps) {
  const primaryItem = getPrimaryDailyItem(items);
  const focusDisabled = !primaryItem || primaryItem.state === "completed" || primaryItem.state === "skipped";
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const [focusState, setFocusState] = useState<FocusState>("idle");
  const [distractionText, setDistractionText] = useState("");
  const [distractions, setDistractions] = useState<string[]>([]);
  const [sessionNote, setSessionNote] = useState("");
  const statusLabel = focusState === "running" ? "In focus" : focusState === "paused" ? "Paused" : "Ready";
  const progressPercent = useMemo(() => {
    const totalSeconds = durationMinutes * 60;
    return Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100);
  }, [durationMinutes, remainingSeconds]);

  useEffect(() => {
    setRemainingSeconds(durationMinutes * 60);
    setFocusState("idle");
  }, [durationMinutes, primaryItem?.id]);

  useEffect(() => {
    if (focusState !== "running") return undefined;

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(intervalId);
          setFocusState("paused");
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [focusState]);

  function parkDistraction() {
    const nextDistraction = distractionText.trim();
    if (!nextDistraction) return;

    setDistractions((current) => [nextDistraction, ...current].slice(0, 5));
    setDistractionText("");
  }

  function resetSession() {
    setFocusState("idle");
    setRemainingSeconds(durationMinutes * 60);
  }

  function saveSessionNote() {
    const body = sessionNote.trim();
    if (!body) return;

    onSaveSessionNote?.({
      body,
      title: `Session note: ${primaryItem?.workItem?.title ?? "Focus session"}`,
      workItemId: primaryItem?.work_item_id,
    });
    setSessionNote("");
  }

  return (
    <section
      aria-label="Drop task into Focus Cockpit"
      className={clsx("orbit-panel overflow-hidden rounded-lg p-4", focusState === "running" && "orbit-focus-active")}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const workItemId = event.dataTransfer.getData("text/plain");
        if (workItemId) onDropWorkItem?.(workItemId);
      }}
    >
      <div className="relative z-10 grid gap-5 md:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="focus-orbit-timer mx-auto grid aspect-square w-full max-w-40 place-items-center rounded-full">
          <div className="text-center">
            <p className="text-3xl font-black tabular-nums text-white">{formatSeconds(remainingSeconds)}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100">{statusLabel}</p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mission-label">Focus Cockpit</p>
          <h2 className="mt-2 min-w-0 break-words text-lg font-black text-white">
            {primaryItem?.workItem?.title ?? "Choose a primary burn"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {primaryItem
              ? "Start a calm focus pass, park distractions, and finish the primary objective."
              : "Add an objective to today's flight plan to unlock the focus session."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {focusDurations.map((duration) => (
              <button
                className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
                  durationMinutes === duration.minutes
                    ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                    : "border-slate-400/20 bg-slate-950/40 text-slate-300 hover:border-cyan-300/45 hover:text-white"
                }`}
                disabled={focusState === "running"}
                key={duration.minutes}
                onClick={() => setDurationMinutes(duration.minutes)}
                type="button"
              >
                {duration.label}
              </button>
            ))}
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-900/80">
            <div
              aria-label="Focus progress"
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-violet-500 transition-all"
              role="progressbar"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {focusState === "running" ? (
              <button
                aria-label="Pause focus session"
                className="orbit-button"
                disabled={focusDisabled}
                onClick={() => setFocusState("paused")}
                type="button"
              >
                <Pause aria-hidden="true" className="h-4 w-4" />
                Pause
              </button>
            ) : (
              <button
                aria-label={focusState === "paused" ? "Resume focus session" : "Launch focus session"}
                className="orbit-button"
                disabled={focusDisabled}
                onClick={() => setFocusState("running")}
                type="button"
              >
                <Play aria-hidden="true" className="h-4 w-4" />
                {focusState === "paused" ? "Resume" : "Launch focus"}
              </button>
            )}
            <button
              className="orbit-button-secondary"
              disabled={focusDisabled}
              onClick={resetSession}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Reset
            </button>
            <button
              aria-label="Complete focus objective"
              className="orbit-button-secondary"
              disabled={focusDisabled || isUpdating || !primaryItem}
              onClick={() => primaryItem ? onComplete?.(primaryItem.id) : undefined}
              type="button"
            >
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Complete
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-5 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Distraction capture</span>
          <textarea
            className="orbit-input min-h-20 resize-y"
            disabled={focusDisabled}
            onChange={(event) => setDistractionText(event.target.value)}
            placeholder="Park a thought without breaking orbit."
            value={distractionText}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="orbit-button-secondary"
            disabled={focusDisabled || distractionText.trim().length === 0}
            onClick={parkDistraction}
            type="button"
          >
            <TimerReset aria-hidden="true" className="h-4 w-4" />
            Park distraction
          </button>
          <span className="text-xs font-semibold text-slate-500">{distractions.length} parked</span>
        </div>
        {distractions.length > 0 ? (
          <ul className="grid gap-2">
            {distractions.map((distraction, index) => (
              <li
                className="rounded-md border border-slate-400/15 bg-slate-950/40 px-3 py-2 text-sm text-slate-300"
                key={`${distraction}-${index}`}
              >
                {distraction}
              </li>
            ))}
          </ul>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Work session notes</span>
          <textarea
            className="orbit-input min-h-20 resize-y"
            disabled={!onSaveSessionNote}
            onChange={(event) => setSessionNote(event.target.value)}
            placeholder="Capture what changed, what shipped, or what to resume next."
            value={sessionNote}
          />
        </label>
        <button
          className="orbit-button-secondary w-fit"
          disabled={!onSaveSessionNote || sessionNote.trim().length === 0}
          onClick={saveSessionNote}
          type="button"
        >
          Save session note
        </button>
      </div>
    </section>
  );
}
