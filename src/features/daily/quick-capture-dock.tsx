import { clsx } from "clsx";
import { ChevronDown, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { CaptureType } from "../../lib/supabase/database.types";

const captureTypes = ["task", "note", "idea", "blocker"] as const satisfies readonly CaptureType[];

export interface QuickCaptureDockValues {
  type: CaptureType;
  title: string;
  body: string;
}

export function QuickCaptureDock({
  isSubmitting,
  onSubmit,
  resetSignal,
}: {
  isSubmitting: boolean;
  onSubmit: (values: QuickCaptureDockValues) => void;
  resetSignal: number;
}) {
  const [type, setType] = useState<CaptureType>("task");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (resetSignal === 0) return;

    setTitle("");
    setBody("");
  }, [resetSignal]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    onSubmit({
      type,
      title: trimmedTitle,
      body: body.trim(),
    });
  }

  return (
    <form
      aria-label="Quick capture"
      className="surface-whisper today-capture-dock relative overflow-hidden rounded-xl p-2"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-2">
        <input
          className="orbit-input flex-1 border-transparent bg-transparent"
          disabled={isSubmitting}
          name="title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Capture a thought — Enter to dock it"
          type="text"
          value={title}
        />
        <button
          aria-expanded={showDetails}
          aria-label="More capture options"
          className="orbit-button-secondary grid h-9 w-9 shrink-0 place-items-center p-0"
          onClick={() => setShowDetails((current) => !current)}
          type="button"
        >
          <ChevronDown
            aria-hidden="true"
            className={clsx("h-4 w-4 transition-transform", showDetails && "rotate-180")}
          />
        </button>
        <button
          aria-label="Dock signal"
          className="orbit-button grid h-9 w-9 shrink-0 place-items-center p-0"
          disabled={isSubmitting || !title.trim()}
          type="submit"
        >
          <Send aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {showDetails ? (
        <div className="mt-2 grid gap-2 border-t border-slate-400/10 px-1 pt-3">
          <Field label="Type">
            <select
              className="orbit-input capitalize"
              disabled={isSubmitting}
              name="type"
              onChange={(event) => setType(event.target.value as CaptureType)}
              value={type}
            >
              {captureTypes.map((captureType) => (
                <option key={captureType} value={captureType}>
                  {captureType}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Signal notes">
            <textarea
              className="orbit-input min-h-20"
              disabled={isSubmitting}
              name="body"
              onChange={(event) => setBody(event.target.value)}
              value={body}
            />
          </Field>
        </div>
      ) : null}
    </form>
  );
}
