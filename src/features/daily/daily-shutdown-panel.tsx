import { MoonStar } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { DailyShutdown, DailyShutdownValues } from "./daily-shutdown.queries";

type DailyShutdownPanelProps = {
  isDisabled?: boolean;
  isLoading?: boolean;
  isSaving: boolean;
  shutdown: DailyShutdown | null;
  onSave: (values: DailyShutdownValues) => void;
};

export function DailyShutdownPanel({ isDisabled = false, isLoading = false, isSaving, shutdown, onSave }: DailyShutdownPanelProps) {
  const [shipped, setShipped] = useState(shutdown?.shipped ?? "");
  const [movedForward, setMovedForward] = useState(shutdown?.moved_forward ?? "");
  const [blocked, setBlocked] = useState(shutdown?.blocked ?? "");
  const [resumeTomorrow, setResumeTomorrow] = useState(shutdown?.resume_tomorrow ?? "");
  const areFieldsDisabled = isDisabled || isLoading;
  const isSubmitDisabled = areFieldsDisabled || isSaving;

  useEffect(() => {
    setShipped(shutdown?.shipped ?? "");
    setMovedForward(shutdown?.moved_forward ?? "");
    setBlocked(shutdown?.blocked ?? "");
    setResumeTomorrow(shutdown?.resume_tomorrow ?? "");
  }, [shutdown?.id, shutdown?.shipped, shutdown?.moved_forward, shutdown?.blocked, shutdown?.resume_tomorrow]);

  function saveShutdown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      shipped,
      movedForward,
      blocked,
      resumeTomorrow,
    });
  }

  return (
    <section className="orbit-panel rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-indigo-300/25 bg-indigo-300/10 text-indigo-100">
          <MoonStar aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="mission-label">Daily shutdown</p>
          <h2 className="mt-2 text-lg font-black text-white">Close the loop before tomorrow.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Capture what changed today and leave yourself a clean re-entry point.
          </p>
        </div>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={saveShutdown}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">What shipped</span>
          <textarea
            className="orbit-input min-h-20 resize-y"
            disabled={areFieldsDisabled}
            onChange={(event) => setShipped(event.target.value)}
            placeholder="Outcomes, releases, decisions, or finished work."
            value={shipped}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">What moved forward</span>
          <textarea
            className="orbit-input min-h-20 resize-y"
            disabled={areFieldsDisabled}
            onChange={(event) => setMovedForward(event.target.value)}
            placeholder="Progress that matters, even if it did not fully ship."
            value={movedForward}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">What got blocked</span>
          <textarea
            className="orbit-input min-h-20 resize-y"
            disabled={areFieldsDisabled}
            onChange={(event) => setBlocked(event.target.value)}
            placeholder="Open loops, risks, or decisions that need attention."
            value={blocked}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Resume tomorrow</span>
          <textarea
            className="orbit-input min-h-20 resize-y"
            disabled={areFieldsDisabled}
            onChange={(event) => setResumeTomorrow(event.target.value)}
            placeholder="The first next action for tomorrow."
            value={resumeTomorrow}
          />
        </label>

        <button className="orbit-button w-fit" disabled={isSubmitDisabled} type="submit">
          <MoonStar aria-hidden="true" className="h-4 w-4" />
          {isSaving ? "Saving shutdown..." : "Save shutdown ritual"}
        </button>
      </form>
    </section>
  );
}
