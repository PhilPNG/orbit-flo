import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import type { GraphLink, GraphTitles } from "./link-graph";

type Client = SupabaseClient<Database>;

export const linkGraphQueryKey = (workspaceId: string) =>
  ["note-links", "graph", workspaceId] as const;

export type LinkGraphData = { links: GraphLink[]; titles: GraphTitles };

const emptyGraph: LinkGraphData = {
  links: [],
  titles: { note: new Map(), task: new Map(), project: new Map(), milestone: new Map() },
};

/**
 * Titles are fetched by id rather than joined. note_links references notes
 * twice — as source and as target — and disambiguating two embeds of the same
 * table means naming the foreign key constraints, which are auto-named
 * composites here. Five small queries beat a fragile string.
 */
export async function loadLinkGraph(client: Client, workspaceId: string): Promise<LinkGraphData> {
  const { data, error } = await client
    .from("note_links")
    .select("note_id, target_note_id, target_work_item_id, target_project_id, target_milestone_id")
    .eq("workspace_id", workspaceId);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    note_id: string;
    target_note_id: string | null;
    target_work_item_id: string | null;
    target_project_id: string | null;
    target_milestone_id: string | null;
  }>;

  if (rows.length === 0) return emptyGraph;

  const links: GraphLink[] = [];
  const noteIds = new Set<string>();
  const taskIds = new Set<string>();
  const projectIds = new Set<string>();
  const milestoneIds = new Set<string>();

  for (const row of rows) {
    noteIds.add(row.note_id);

    if (row.target_work_item_id) {
      links.push({ noteId: row.note_id, targetKind: "task", targetId: row.target_work_item_id });
      taskIds.add(row.target_work_item_id);
    } else if (row.target_project_id) {
      links.push({ noteId: row.note_id, targetKind: "project", targetId: row.target_project_id });
      projectIds.add(row.target_project_id);
    } else if (row.target_milestone_id) {
      links.push({ noteId: row.note_id, targetKind: "milestone", targetId: row.target_milestone_id });
      milestoneIds.add(row.target_milestone_id);
    } else if (row.target_note_id) {
      links.push({ noteId: row.note_id, targetKind: "note", targetId: row.target_note_id });
      noteIds.add(row.target_note_id);
    }
  }

  const [notes, tasks, projects, milestones] = await Promise.all([
    client.from("notes").select("id, title").in("id", [...noteIds]),
    taskIds.size > 0
      ? client.from("work_items").select("id, title").in("id", [...taskIds])
      : Promise.resolve({ data: [], error: null }),
    projectIds.size > 0
      ? client.from("projects").select("id, name").in("id", [...projectIds])
      : Promise.resolve({ data: [], error: null }),
    milestoneIds.size > 0
      ? client.from("milestones").select("id, title").in("id", [...milestoneIds])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (notes.error) throw notes.error;
  if (tasks.error) throw tasks.error;
  if (projects.error) throw projects.error;
  if (milestones.error) throw milestones.error;

  const titles: GraphTitles = {
    note: new Map(),
    task: new Map(),
    project: new Map(),
    milestone: new Map(),
  };

  for (const row of (notes.data ?? []) as Array<{ id: string; title: string }>) {
    titles.note.set(row.id, row.title);
  }
  for (const row of (tasks.data ?? []) as Array<{ id: string; title: string }>) {
    titles.task.set(row.id, row.title);
  }
  for (const row of (projects.data ?? []) as Array<{ id: string; name: string }>) {
    titles.project.set(row.id, row.name);
  }
  for (const row of (milestones.data ?? []) as Array<{ id: string; title: string }>) {
    titles.milestone.set(row.id, row.title);
  }

  return { links, titles };
}
