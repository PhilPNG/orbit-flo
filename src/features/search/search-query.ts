import type { NoteType } from "../../lib/supabase/database.types";
import type { SearchResultType } from "./search.queries";

export type ParsedSearchQuery = {
  /** Whatever was left after the operators were taken out. */
  text: string;
  kinds: SearchResultType[];
  tags: string[];
  noteTypes: NoteType[];
};

/** Free text needs a couple of characters to be worth a query; operators do not. */
export const minSearchLength = 2;

const searchKinds: readonly SearchResultType[] = ["task", "note", "project", "milestone"];
const noteTypes: readonly NoteType[] = ["idea", "question", "decision", "risk", "reference"];

function isKind(value: string): value is SearchResultType {
  return (searchKinds as readonly string[]).includes(value);
}

function isNoteType(value: string): value is NoteType {
  return (noteTypes as readonly string[]).includes(value);
}

/**
 * `is:note type:decision tag:payments overdue` — operators are lifted out and
 * everything else stays as free text. An unrecognised value is left in the
 * text rather than silently dropped, so a typo shows up as a bad search rather
 * than as a filter that quietly matched nothing.
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const kinds: SearchResultType[] = [];
  const tags: string[] = [];
  const parsedNoteTypes: NoteType[] = [];
  const rest: string[] = [];

  for (const token of raw.split(/\s+/).filter(Boolean)) {
    const separator = token.indexOf(":");
    const operator = separator === -1 ? "" : token.slice(0, separator).toLowerCase();
    const value = separator === -1 ? "" : token.slice(separator + 1).toLowerCase();

    if (!value) {
      rest.push(token);
      continue;
    }

    if (operator === "is" && isKind(value)) {
      if (!kinds.includes(value)) kinds.push(value);
      continue;
    }

    if (operator === "tag") {
      if (!tags.includes(value)) tags.push(value);
      continue;
    }

    if (operator === "type" && isNoteType(value)) {
      if (!parsedNoteTypes.includes(value)) parsedNoteTypes.push(value);
      continue;
    }

    rest.push(token);
  }

  return { text: rest.join(" "), kinds, tags, noteTypes: parsedNoteTypes };
}

/**
 * An operator on its own is a valid search: `tag:design` should list every
 * design note without also demanding a text term.
 */
export function hasSearchCriteria(query: ParsedSearchQuery): boolean {
  return (
    query.text.trim().length >= minSearchLength ||
    query.kinds.length > 0 ||
    query.tags.length > 0 ||
    query.noteTypes.length > 0
  );
}
