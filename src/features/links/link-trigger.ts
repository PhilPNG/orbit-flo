import { findMentionTrigger } from "./mention";

/**
 * The fiddly half of the autocomplete, kept pure so it can be tested without a
 * DOM: given the body and where the caret is, is the user mid-`[[`, and what
 * have they typed since?
 */
export type LinkTrigger = { start: number; query: string };

export type ActiveTrigger = { kind: "link" | "mention"; start: number; query: string };

const TRIGGER = "[[";

export function findLinkTrigger(body: string, caret: number): LinkTrigger | null {
  const before = body.slice(0, caret);
  const start = before.lastIndexOf(TRIGGER);
  if (start === -1) return null;

  const query = before.slice(start + TRIGGER.length);

  // A newline or a closing bracket means the trigger was abandoned rather than
  // still being typed into.
  if (/[\n\]]/.test(query)) return null;

  return { start, query };
}

/**
 * One picker, two sources. Whichever trigger starts later is the one the caret
 * is actually inside.
 */
export function findTrigger(body: string, caret: number): ActiveTrigger | null {
  const link = findLinkTrigger(body, caret);
  const mention = findMentionTrigger(body, caret);

  if (link && mention) {
    return mention.start > link.start
      ? { kind: "mention", ...mention }
      : { kind: "link", ...link };
  }
  if (link) return { kind: "link", ...link };
  if (mention) return { kind: "mention", ...mention };
  return null;
}

/** Replaces the `[[query` run with the finished link. */
export function replaceTrigger(
  body: string,
  trigger: LinkTrigger,
  caret: number,
  replacement: string,
): { body: string; caret: number } {
  const next = body.slice(0, trigger.start) + replacement + body.slice(caret);

  return { body: next, caret: trigger.start + replacement.length };
}
