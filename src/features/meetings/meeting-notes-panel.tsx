import { CheckCircle2, NotebookPen, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { Database } from "../../lib/supabase/database.types";
import type { MeetingNoteValues } from "./meeting-notes.queries";

type MeetingNote = Database["public"]["Tables"]["meeting_notes"]["Row"];
type MeetingActionItem = Database["public"]["Tables"]["meeting_action_items"]["Row"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function blankValues(): MeetingNoteValues {
  return {
    title: "",
    meetingDate: todayKey(),
    attendees: [],
    discussion: "",
    decisions: "",
    risks: "",
    actionItems: [{ title: "", ownerLabel: "", dueDate: "" }],
  };
}

function attendeeText(attendees: string[]) {
  return attendees.join(", ");
}

function parseAttendees(value: string) {
  return value
    .split(",")
    .map((attendee) => attendee.trim())
    .filter(Boolean);
}

export function MeetingNotesPanel({
  actionItems,
  isConverting = false,
  isLoading = false,
  isSaving = false,
  meetingNotes,
  onConvertActionItem,
  onSaveMeeting,
}: {
  actionItems: MeetingActionItem[];
  isConverting?: boolean;
  isLoading?: boolean;
  isSaving: boolean;
  meetingNotes: MeetingNote[];
  onConvertActionItem: (id: string) => Promise<void> | void;
  onSaveMeeting: (values: MeetingNoteValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<MeetingNoteValues>(() => blankValues());
  const [attendees, setAttendees] = useState("");
  const [titleError, setTitleError] = useState("");
  const isDirty = useRef(false);
  const isDisabled = isLoading || isSaving || isConverting;

  useEffect(() => {
    if (!isDirty.current) {
      setValues(blankValues());
      setAttendees("");
      setTitleError("");
    }
  }, [meetingNotes]);

  function updateValue(field: keyof Omit<MeetingNoteValues, "attendees" | "actionItems">, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    isDirty.current = true;
    if (field === "title" && value.trim()) setTitleError("");
  }

  function updateActionItem(index: number, field: "title" | "ownerLabel" | "dueDate", value: string) {
    setValues((current) => ({
      ...current,
      actionItems: current.actionItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
    isDirty.current = true;
  }

  function addActionItem() {
    setValues((current) => ({
      ...current,
      actionItems: [...current.actionItems, { title: "", ownerLabel: "", dueDate: "" }],
    }));
    isDirty.current = true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = values.title.trim();

    if (!title) {
      setTitleError("Add a meeting title before saving.");
      return;
    }

    const nextValues: MeetingNoteValues = {
      ...values,
      title,
      meetingDate: values.meetingDate || todayKey(),
      attendees: parseAttendees(attendees),
      discussion: values.discussion.trim(),
      decisions: values.decisions.trim(),
      risks: values.risks.trim(),
      actionItems: values.actionItems.map((item) => ({
        title: item.title.trim(),
        ownerLabel: item.ownerLabel.trim(),
        dueDate: item.dueDate,
      })),
    };

    setValues(nextValues);
    try {
      await onSaveMeeting(nextValues);
      setValues(blankValues());
      setAttendees("");
      setTitleError("");
      isDirty.current = false;
    } catch {
      // The workspace renders save failures; keep the current meeting draft.
    }
  }

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <NotebookPen size={17} aria-hidden="true" />
        </span>
        <div>
          <p className="mission-label">Meeting capture</p>
          <h2 className="mt-1 text-lg font-black text-white">Meeting notes</h2>
        </div>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Meeting title">
            <input
              className="orbit-input"
              disabled={isDisabled}
              onChange={(event) => updateValue("title", event.target.value)}
              value={values.title}
            />
          </Field>
          <Field label="Meeting date">
            <input
              className="orbit-input"
              disabled={isDisabled}
              onChange={(event) => updateValue("meetingDate", event.target.value)}
              type="date"
              value={values.meetingDate}
            />
          </Field>
        </div>

        <Field label="Attendees">
          <input
            className="orbit-input"
            disabled={isDisabled}
            onChange={(event) => {
              setAttendees(event.target.value);
              isDirty.current = true;
            }}
            value={attendees}
          />
        </Field>

        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Discussion">
            <textarea
              className="orbit-input min-h-24"
              disabled={isDisabled}
              onChange={(event) => updateValue("discussion", event.target.value)}
              value={values.discussion}
            />
          </Field>
          <Field label="Decisions">
            <textarea
              className="orbit-input min-h-24"
              disabled={isDisabled}
              onChange={(event) => updateValue("decisions", event.target.value)}
              value={values.decisions}
            />
          </Field>
          <Field label="Risks">
            <textarea
              className="orbit-input min-h-24"
              disabled={isDisabled}
              onChange={(event) => updateValue("risks", event.target.value)}
              value={values.risks}
            />
          </Field>
        </div>

        <div className="grid gap-3">
          {values.actionItems.map((item, index) => (
            <div className="grid gap-3 rounded-md border border-slate-400/15 bg-slate-950/30 p-3 lg:grid-cols-[minmax(0,1fr)_12rem_10rem]" key={index}>
              <Field label="Action item">
                <input
                  className="orbit-input"
                  disabled={isDisabled}
                  onChange={(event) => updateActionItem(index, "title", event.target.value)}
                  value={item.title}
                />
              </Field>
              <Field label="Owner">
                <input
                  className="orbit-input"
                  disabled={isDisabled}
                  onChange={(event) => updateActionItem(index, "ownerLabel", event.target.value)}
                  value={item.ownerLabel}
                />
              </Field>
              <Field label="Due date">
                <input
                  className="orbit-input"
                  disabled={isDisabled}
                  onChange={(event) => updateActionItem(index, "dueDate", event.target.value)}
                  type="date"
                  value={item.dueDate}
                />
              </Field>
            </div>
          ))}
          <button className="orbit-button-secondary w-fit" disabled={isDisabled} onClick={addActionItem} type="button">
            <Plus size={16} aria-hidden="true" />
            Add action item
          </button>
        </div>

        {titleError ? <p className="text-sm font-semibold text-rose-100">{titleError}</p> : null}

        <div className="flex justify-end">
          <button className="orbit-button" disabled={isDisabled} type="submit">
            Save meeting note
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-black uppercase text-slate-300">Recent notes</h3>
          <div className="mt-2 grid gap-2">
            {meetingNotes.length === 0 ? (
              <p className="rounded-md border border-slate-400/15 px-3 py-2 text-sm text-slate-400">No meeting notes yet.</p>
            ) : (
              meetingNotes.map((note) => (
                <article className="rounded-md border border-slate-400/15 bg-slate-950/30 p-3" key={note.id}>
                  <h4 className="font-bold text-white">{note.title}</h4>
                  <p className="text-xs text-slate-400">
                    {note.meeting_date}
                    {note.attendees.length ? ` - ${attendeeText(note.attendees)}` : ""}
                  </p>
                  {note.discussion ? <p className="mt-2 text-sm text-slate-200">{note.discussion}</p> : null}
                </article>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black uppercase text-slate-300">Action items</h3>
          <div className="mt-2 grid gap-2">
            {actionItems.length === 0 ? (
              <p className="rounded-md border border-slate-400/15 px-3 py-2 text-sm text-slate-400">No action items captured yet.</p>
            ) : (
              actionItems.map((item) => (
                <article className="flex flex-col gap-3 rounded-md border border-slate-400/15 bg-slate-950/30 p-3 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
                  <div>
                    <h4 className="font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-400">
                      {item.owner_label || "Unassigned"}
                      {item.due_date ? ` - Due ${item.due_date}` : ""}
                    </p>
                  </div>
                  {item.is_converted ? (
                    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
                      <CheckCircle2 size={14} aria-hidden="true" />
                      Converted
                    </span>
                  ) : (
                    <button
                      className="orbit-button-secondary"
                      disabled={isDisabled}
                      onClick={() => onConvertActionItem(item.id)}
                      type="button"
                    >
                      Convert {item.title} to task
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
