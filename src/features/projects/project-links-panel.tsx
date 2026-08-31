import { BookOpen, CircleDot, Cloud, GitBranch, Link2, Palette, Pencil, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "../../components/field";
import type { LinkType } from "../../lib/supabase/database.types";
import { linkTypeLabel, linkTypes, safeLinkUrl, type ProjectLink } from "./project-links.queries";

const linkTypeIcons: Record<LinkType, LucideIcon> = {
  repository: GitBranch,
  documentation: BookOpen,
  design: Palette,
  deployment: Cloud,
  issue_tracker: CircleDot,
  other: Link2,
};

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

type LinkValues = { linkType: LinkType; label: string; url: string };

/** The same three controls serve the add row and the inline editor. */
function LinkFields({
  disabled,
  onChange,
  values,
}: {
  disabled: boolean;
  onChange: (values: LinkValues) => void;
  values: LinkValues;
}) {
  return (
    <>
      <Field label="Link type">
        <select
          className="orbit-input"
          disabled={disabled}
          onChange={(event) => onChange({ ...values, linkType: event.target.value as LinkType })}
          value={values.linkType}
        >
          {linkTypes.map((type) => (
            <option key={type} value={type}>
              {linkTypeLabel(type)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label">
        <input
          className="orbit-input"
          disabled={disabled}
          onChange={(event) => onChange({ ...values, label: event.target.value })}
          placeholder={linkTypeLabel(values.linkType)}
          value={values.label}
        />
      </Field>

      <Field label="URL">
        <input
          className="orbit-input"
          disabled={disabled}
          onChange={(event) => onChange({ ...values, url: event.target.value })}
          placeholder="https://"
          value={values.url}
        />
      </Field>
    </>
  );
}

const emptyDraft: LinkValues = { linkType: "repository", label: "", url: "" };

export function ProjectLinksPanel({
  links,
  isLoading = false,
  isSaving = false,
  errorMessage = null,
  onCreate,
  onUpdate,
  onDelete,
}: {
  links: ProjectLink[];
  isLoading?: boolean;
  isSaving?: boolean;
  errorMessage?: string | null;
  onCreate: (values: LinkValues) => Promise<void> | void;
  onUpdate: (id: string, values: LinkValues) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<LinkValues>(emptyDraft);
  // One row edits at a time; the add row keeps its own draft either way.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LinkValues>(emptyDraft);
  const isDisabled = isLoading || isSaving;

  function startEditing(item: ProjectLink) {
    setEditingId(item.id);
    setEditDraft({ linkType: item.link_type, label: item.label, url: item.url });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await onCreate(draft);
      setDraft(emptyDraft);
    } catch {
      // The workspace renders the failure; keep the draft so nothing is retyped.
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();

    try {
      await onUpdate(id, editDraft);
      setEditingId(null);
    } catch {
      // Stay open so the correction is not lost.
    }
  }

  return (
    <section aria-label="Mission links" className="grid gap-3">
      <h3 className="text-sm font-semibold text-white">Mission links</h3>

      {links.length === 0 ? (
        <p className="text-sm text-slate-400">No links yet. Add the repository, docs, or deployment.</p>
      ) : (
        <ul className="grid gap-1.5">
          {links.map((item) => {
            const Icon = linkTypeIcons[item.link_type];
            const href = safeLinkUrl(item.url);

            if (editingId === item.id) {
              return (
                <li
                  className="rounded-lg border border-cyan-300/25 bg-cyan-300/[0.04] px-3 py-2"
                  key={item.id}
                >
                  <form
                    className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1.5fr)]"
                    onSubmit={(event) => void handleEditSubmit(event, item.id)}
                  >
                    <LinkFields disabled={isDisabled} onChange={setEditDraft} values={editDraft} />
                    <div className="flex gap-2 sm:col-span-3">
                      <button className="orbit-button-secondary" disabled={isDisabled} type="submit">
                        Save link
                      </button>
                      <button
                        className="orbit-button-secondary"
                        onClick={() => setEditingId(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li
                className="flex items-center gap-2.5 rounded-lg border border-slate-400/10 bg-white/[0.02] px-3 py-2"
                key={item.id}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  {href ? (
                    <a
                      className="block truncate text-sm font-semibold text-cyan-200 hover:text-cyan-100"
                      href={href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className="block truncate text-sm font-semibold text-slate-300">{item.label}</span>
                  )}
                  <span className="block truncate text-xs text-slate-500">{hostname(item.url)}</span>
                </span>
                <button
                  aria-label={`Edit ${item.label}`}
                  className="orbit-field-icon-button shrink-0"
                  disabled={isDisabled}
                  onClick={() => startEditing(item)}
                  type="button"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Remove ${item.label}`}
                  className="orbit-field-icon-button shrink-0"
                  disabled={isDisabled}
                  onClick={() => void onDelete(item.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {errorMessage ? (
        <p
          className="rounded-md border border-violet-300/35 bg-violet-400/10 px-3 py-2 text-sm text-violet-100"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1.5fr)_auto]" onSubmit={handleSubmit}>
        <LinkFields disabled={isDisabled} onChange={setDraft} values={draft} />

        <div className="flex items-end">
          <button className="orbit-button-secondary w-full" disabled={isDisabled} type="submit">
            Add link
          </button>
        </div>
      </form>
    </section>
  );
}
