import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { NoteType } from "../../lib/supabase/database.types";
import { noteTypeLabel, noteTypes } from "./notes.queries";
import { LinkingTextarea } from "../links/linking-textarea";
import { parseTagInput } from "./note-tags";

export interface NoteFormValues {
  noteType: NoteType;
  title: string;
  body: string;
  tags: string[];
}

export function NoteForm({
  isSubmitting = false,
  onSubmit,
}: {
  isSubmitting?: boolean;
  onSubmit: (values: NoteFormValues) => void;
}) {
  const [noteType, setNoteType] = useState<NoteType>("idea");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) return;

    onSubmit({
      noteType,
      title: trimmedTitle,
      body: body.trim(),
      tags: parseTagInput(tags),
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="Type">
          <select
            className="orbit-input"
            disabled={isSubmitting}
            name="note_type"
            onChange={(event) => setNoteType(event.target.value as NoteType)}
            value={noteType}
          >
            {noteTypes.map((value) => (
              <option key={value} value={value}>
                {noteTypeLabel(value)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title">
          <input
            autoFocus
            className="orbit-input"
            disabled={isSubmitting}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            required
            type="text"
            value={title}
          />
        </Field>
      </div>

      <Field label="Body">
        {/* Type [[ to link a task, note or project. */}
        <LinkingTextarea
          className="orbit-input min-h-28"
          disabled={isSubmitting}
          name="body"
          onChange={setBody}
          value={body}
        />
      </Field>

      <Field label="Tags">
        <input
          className="orbit-input"
          disabled={isSubmitting}
          name="tags"
          onChange={(event) => setTags(event.target.value)}
          type="text"
          value={tags}
        />
      </Field>

      <div className="flex justify-end">
        <button
          className="orbit-button"
          disabled={isSubmitting || !title.trim()}
          type="submit"
        >
          {isSubmitting ? "Capturing..." : "Capture note"}
        </button>
      </div>
    </form>
  );
}
