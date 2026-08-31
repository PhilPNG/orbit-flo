import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NoteType } from "../../lib/supabase/database.types";
import { saveNoteLinks } from "./note-links.queries";
import { formatOrbitLink, type LinkKind } from "./orbit-link";

type Client = SupabaseClient<Database>;

export type UnlinkedMention = { id: string; title: string; noteType: NoteType };

export const unlinkedMentionsQueryKey = (workspaceId: string, kind: LinkKind, id: string) =>
  ["note-links", "mentions", workspaceId, kind, id] as const;

export async function listUnlinkedMentions(
  client: Client,
  input: { kind: LinkKind; id: string },
): Promise<UnlinkedMention[]> {
  const { data, error } = await client.rpc("find_unlinked_mentions", {
    target_kind: input.kind,
    target_id: input.id,
  });

  if (error) throw error;

  return ((data ?? []) as Array<{ note_id: string; title: string; note_type: NoteType }>).map(
    (row) => ({ id: row.note_id, title: row.title, noteType: row.note_type }),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrites the first bare occurrence of a title into a link, leaving the text
 * the author actually typed as the label rather than substituting the
 * canonical title.
 */
export function linkMentionInBody(
  body: string,
  title: string,
  kind: LinkKind,
  id: string,
): string {
  const pattern = new RegExp(escapeRegExp(title), "i");
  const match = pattern.exec(body);
  if (!match) return body;

  const start = match.index;
  const end = start + match[0].length;

  // An occurrence already inside a markdown link must not be wrapped again —
  // that would produce [[label](url)](url) and break the body.
  const before = body.slice(0, start);
  const after = body.slice(end);
  const isInsideLink = /\[[^\]]*$/.test(before) || /^[^[]*\]\(/.test(after);
  if (isInsideLink) return body;

  return before + formatOrbitLink(kind, id, match[0]) + after;
}

/** Links a mention by rewriting the note it lives in. */
export async function linkMention(
  client: Client,
  input: {
    workspaceId: string;
    userId: string;
    noteId: string;
    title: string;
    kind: LinkKind;
    id: string;
  },
): Promise<string> {
  const { data, error } = await client
    .from("notes")
    .select("body")
    .eq("id", input.noteId)
    .single();

  if (error) throw error;

  const nextBody = linkMentionInBody(data.body ?? "", input.title, input.kind, input.id);
  if (nextBody === (data.body ?? "")) return nextBody;

  const { error: updateError } = await client
    .from("notes")
    .update({ body: nextBody })
    .eq("id", input.noteId);

  if (updateError) throw updateError;

  // This writes the body directly rather than through createNote, so it must
  // reconcile the link table itself — otherwise the mention would vanish from
  // this panel without ever appearing as a backlink.
  await saveNoteLinks(client, {
    workspaceId: input.workspaceId,
    noteId: input.noteId,
    userId: input.userId,
    body: nextBody,
  });

  return nextBody;
}
