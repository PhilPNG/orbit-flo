import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SignalKind } from "../../lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Signal = {
  id: string;
  kind: SignalKind;
  createdAt: string;
  readAt: string | null;
  actorId: string | null;
  actorName: string | null;
  workItemId: string | null;
  noteId: string | null;
  targetTitle: string | null;
};

export const signalsQueryKey = (workspaceId: string) => ["signals", workspaceId] as const;

export const unreadSignalCountQueryKey = (workspaceId: string) =>
  ["signals", "unread-count", workspaceId] as const;

/** Not workspace-scoped on purpose: this feeds the switcher dot. */
export const unreadByWorkspaceQueryKey = ["signals", "unread-by-workspace"] as const;

const listLimit = 50;

export async function listSignals(client: Client, workspaceId: string): Promise<Signal[]> {
  const { data, error } = await client
    .from("signals")
    // profiles!actor_id, not a bare profiles(...): the embed is pinned to the
    // foreign key it travels. A second FK from signals to profiles would
    // otherwise make this ambiguous at runtime with nothing to catch it.
    .select("id, kind, created_at, read_at, actor_id, work_item_id, note_id, profiles!actor_id(display_name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(listLimit);

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    kind: SignalKind;
    created_at: string;
    read_at: string | null;
    actor_id: string | null;
    work_item_id: string | null;
    note_id: string | null;
    profiles: { display_name: string } | null;
  }>;

  const workItemIds = new Set<string>();
  const noteIds = new Set<string>();
  for (const row of rows) {
    if (row.work_item_id) workItemIds.add(row.work_item_id);
    if (row.note_id) noteIds.add(row.note_id);
  }

  // Titles are fetched by id rather than joined, the same shape as
  // loadLinkGraph: a bare profiles(...) embed already needed disambiguating
  // to actor_id above, and work_items/notes would need the same treatment
  // for no benefit, since the ids are already in hand from the row above.
  const [workItems, notes] = await Promise.all([
    workItemIds.size > 0
      ? client.from("work_items").select("id, title").in("id", [...workItemIds])
      : Promise.resolve({ data: [], error: null }),
    noteIds.size > 0
      ? client.from("notes").select("id, title").in("id", [...noteIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (workItems.error) throw workItems.error;
  if (notes.error) throw notes.error;

  const workItemTitles = new Map<string, string>();
  for (const row of (workItems.data ?? []) as Array<{ id: string; title: string }>) {
    workItemTitles.set(row.id, row.title);
  }

  const noteTitles = new Map<string, string>();
  for (const row of (notes.data ?? []) as Array<{ id: string; title: string }>) {
    noteTitles.set(row.id, row.title);
  }

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    createdAt: row.created_at,
    readAt: row.read_at,
    actorId: row.actor_id,
    actorName: row.profiles?.display_name ?? null,
    workItemId: row.work_item_id,
    noteId: row.note_id,
    targetTitle: row.work_item_id
      ? (workItemTitles.get(row.work_item_id) ?? null)
      : row.note_id
        ? (noteTitles.get(row.note_id) ?? null)
        : null,
  }));
}

export async function countUnreadSignals(client: Client, workspaceId: string): Promise<number> {
  const { count, error } = await client
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * "My unread everywhere" by construction: RLS already restricts signals to
 * recipient_id = auth.uid(), so no filter and no RPC are needed. Counted in the
 * client because PostgREST has no group-by.
 */
export async function unreadCountsByWorkspace(client: Client): Promise<Map<string, number>> {
  const { data, error } = await client.from("signals").select("workspace_id").is("read_at", null);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ workspace_id: string }>) {
    counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
  }

  return counts;
}

export async function markSignalRead(client: Client, input: { id: string }) {
  const { error } = await client
    .from("signals")
    .update({ read_at: new Date().toISOString() })
    .eq("id", input.id);

  if (error) throw error;
}

/**
 * The .is("read_at", null) filter is load-bearing: without it, this rewrites
 * read_at on rows that were already read, destroying when-was-this-read
 * information for every signal in the workspace, not just the unread ones.
 */
export async function markAllSignalsRead(client: Client, input: { workspaceId: string }) {
  const { error } = await client
    .from("signals")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .is("read_at", null);

  if (error) throw error;
}
