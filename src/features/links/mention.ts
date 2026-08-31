/**
 * Mentions deliberately live outside orbit-link.ts. LinkKind stays a closed
 * union of the kinds note_links has a column for, so saveNoteLinks and
 * targetColumnFor cannot receive a user link that note_links has no column
 * for.
 */
export const mentionHrefPattern =
  /^orbit:user\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

const TRIGGER = "@";

/** Brackets in a name would terminate the markdown link early. */
function safeLabel(label: string) {
  return label.replaceAll("[", "(").replaceAll("]", ")");
}

export function formatMention(userId: string, displayName: string): string {
  return `[@${safeLabel(displayName)}](orbit:user/${userId})`;
}

export function findMentionTrigger(
  body: string,
  caret: number,
): { start: number; query: string } | null {
  const before = body.slice(0, caret);
  const start = before.lastIndexOf(TRIGGER);
  if (start === -1) return null;

  // Word boundary: start of body, or preceded by whitespace. Without this,
  // typing any email address opens the mention picker.
  const preceding = start === 0 ? "" : before[start - 1];
  if (preceding !== "" && !/\s/.test(preceding)) return null;

  const query = before.slice(start + TRIGGER.length);

  // A newline or a closing bracket means the trigger was abandoned.
  if (/[\n\]]/.test(query)) return null;

  return { start, query };
}
