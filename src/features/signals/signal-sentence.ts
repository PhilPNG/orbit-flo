import type { SignalKind } from "../../lib/supabase/database.types";

export type SignalSentenceInput = {
  kind: SignalKind;
  actorName: string | null;
  targetTitle: string | null;
};

/**
 * Every branch of the inbox copy lives here, so the one part of this feature
 * with real branching is testable without a database.
 */
export function buildSignalSentence({
  kind,
  actorName,
  targetTitle,
}: SignalSentenceInput): string {
  // actor_id is `on delete set null`: a departed colleague leaves a null, and
  // "Someone" is honest where a blank would look like a rendering bug.
  const actor = actorName ?? "Someone";

  switch (kind) {
    case "assigned":
      return `${actor} assigned you ${targetTitle ?? "a deleted task"}`;
    case "unassigned":
      return `${actor} unassigned you from ${targetTitle ?? "a deleted task"}`;
    case "commented":
      return `${actor} commented on ${targetTitle ?? "a deleted task"}`;
    case "mentioned":
      // A mention can live in a note or in a comment on a task, so "note" is
      // wrong on the comment path — use the neutral noun for both.
      return `${actor} mentioned you in ${targetTitle ?? "a deleted item"}`;
    case "invitation_accepted":
      return `${actor} accepted your invitation`;
    case "role_changed":
      return `${actor} changed your role`;
    case "removed_from_workspace":
      // Dead as of the private.signal_removal removal (#see 202608180005):
      // the recipient of this signal is by definition no longer a workspace
      // member, so RLS can never let them read the row, and the Signals page
      // is workspace-scoped so there's nowhere to render it either. The enum
      // value survives (dropping a Postgres enum value means recreating the
      // type), so this branch stays only to keep the switch exhaustive over
      // SignalKind — never write this string; never expect it to be seen.
      return `${actor} removed you from this workspace`;
  }
}
