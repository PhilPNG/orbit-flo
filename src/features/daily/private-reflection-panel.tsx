import { LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { PrivateReflection } from "./private-reflections.queries";

export type PrivateReflectionCreateValues = {
  title: string;
  body: string;
  mood: string;
};

type PrivateReflectionPanelProps = {
  isDisabled?: boolean;
  isSaving: boolean;
  reflections: PrivateReflection[];
  onCreate: (values: PrivateReflectionCreateValues) => void | Promise<unknown>;
};

export function PrivateReflectionPanel({
  isDisabled = false,
  isSaving,
  reflections,
  onCreate,
}: PrivateReflectionPanelProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("clear");
  const isSubmitDisabled = isDisabled || isSaving || !title.trim() || !body.trim();

  async function saveReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) return;

    try {
      await onCreate({
        title: trimmedTitle,
        body: trimmedBody,
        mood: mood.trim() || "clear",
      });

      setTitle("");
      setBody("");
      setMood("clear");
    } catch {
      return;
    }
  }

  return (
    <section className="orbit-panel rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <LockKeyhole aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="mission-label">Private reflection</p>
          <h2 className="mt-2 text-lg font-black text-white">Capture the lesson underneath the work.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            A private note for patterns, energy, and what you want tomorrow-you to remember.
          </p>
        </div>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={saveReflection}>
        <Field label="Reflection title">
          <input
            className="orbit-input"
            disabled={isDisabled || isSaving}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            type="text"
            value={title}
          />
        </Field>

        <Field label="Private reflection">
          <textarea
            className="orbit-input min-h-28 resize-y"
            disabled={isDisabled || isSaving}
            name="body"
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
        </Field>

        <Field label="Mood">
          <input
            className="orbit-input"
            disabled={isDisabled || isSaving}
            name="mood"
            onChange={(event) => setMood(event.target.value)}
            type="text"
            value={mood}
          />
        </Field>

        <button className="orbit-button w-fit" disabled={isSubmitDisabled} type="submit">
          <LockKeyhole aria-hidden="true" className="h-4 w-4" />
          {isSaving ? "Saving reflection..." : "Save private reflection"}
        </button>
      </form>

      {reflections.length > 0 ? (
        <div className="mt-5 border-t border-slate-400/10 pt-4">
          <p className="mission-label">Recent private reflections</p>
          <div className="mt-3 grid gap-3">
            {reflections.map((reflection) => (
              <article className="rounded-lg border border-slate-400/10 bg-slate-950/35 p-3" key={reflection.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">{reflection.title}</h3>
                  <time className="text-xs font-semibold text-slate-500" dateTime={reflection.reflection_date}>
                    {reflection.reflection_date}
                  </time>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{reflection.body}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">{reflection.mood}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
