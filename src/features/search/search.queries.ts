import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase/database.types";
import { hasSearchCriteria, minSearchLength, parseSearchQuery } from "./search-query";

type Client = SupabaseClient<Database>;

export type SearchResultType = "task" | "note" | "project" | "milestone";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  to: string;
  matchedTitle: boolean;
  updatedAt: string;
}

export const searchKeys = {
  workspace: (workspaceId: string, term: string) => ["workspace-search", workspaceId, term] as const,
};

export { minSearchLength } from "./search-query";

// PostgREST parses or() as a comma and parenthesis delimited list, so these
// characters would break the filter or silently change which rows match.
const unsafeFilterCharacters = /[,()%\\]/g;

export function escapeSearchTerm(term: string): string {
  return term.replace(unsafeFilterCharacters, "").trim();
}

export function rankSearchResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => {
    if (a.matchedTitle !== b.matchedTitle) return a.matchedTitle ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  updated_at: string;
  projects: { name: string } | null;
}

interface NoteRow {
  id: string;
  title: string;
  body: string | null;
  note_type: string;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  updated_at: string;
}

interface MilestoneRow {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  updated_at: string;
}

function matchesTitle(title: string, term: string) {
  return title.toLowerCase().includes(term.toLowerCase());
}

export async function searchWorkspace(
  client: Client,
  workspaceId: string,
  rawTerm: string,
): Promise<SearchResult[]> {
  const query = parseSearchQuery(rawTerm);
  if (!hasSearchCriteria(query)) return [];

  const safe = escapeSearchTerm(query.text);
  const hasText = safe.length >= minSearchLength;

  // A kind filter skips whole queries rather than discarding rows afterwards,
  // and tag/type go into SQL so they are not defeated by the per-kind limit.
  const wants = (kind: SearchResultType) =>
    query.kinds.length === 0 || query.kinds.includes(kind);

  // tag: and type: only describe notes, so asking for either means notes only.
  const notesOnly = query.tags.length > 0 || query.noteTypes.length > 0;
  const empty = Promise.resolve({ data: [], error: null });

  const [tasks, notes, projects, milestones] = await Promise.all([
    wants("task") && !notesOnly
      ? (() => {
          let builder = client
            .from("work_items")
            .select("id, project_id, title, description, updated_at, projects(name)")
            .eq("workspace_id", workspaceId);

          if (hasText) builder = builder.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);

          return builder.order("updated_at", { ascending: false }).limit(10);
        })()
      : empty,
    wants("note")
      ? (() => {
          let builder = client
            .from("notes")
            .select("id, title, body, note_type, updated_at")
            .eq("workspace_id", workspaceId);

          if (hasText) builder = builder.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
          // Array containment, so several tags narrow rather than widen.
          if (query.tags.length > 0) builder = builder.contains("tags", query.tags);
          if (query.noteTypes.length > 0) builder = builder.in("note_type", query.noteTypes);

          return builder.order("updated_at", { ascending: false }).limit(10);
        })()
      : empty,
    wants("project") && !notesOnly
      ? (() => {
          let builder = client
            .from("projects")
            .select("id, name, description, status, updated_at")
            .eq("workspace_id", workspaceId);

          if (hasText) builder = builder.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);

          return builder.order("updated_at", { ascending: false }).limit(10);
        })()
      : empty,
    wants("milestone") && !notesOnly
      ? (() => {
          let builder = client
            .from("milestones")
            .select("id, title, description, project_id, updated_at")
            .eq("workspace_id", workspaceId);

          if (hasText) builder = builder.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);

          return builder.order("updated_at", { ascending: false }).limit(10);
        })()
      : empty,
  ]);

  if (tasks.error) throw tasks.error;
  if (notes.error) throw notes.error;
  if (projects.error) throw projects.error;
  if (milestones.error) throw milestones.error;

  const taskResults: SearchResult[] = ((tasks.data ?? []) as unknown as TaskRow[]).map((row) => ({
    id: row.id,
    type: "task",
    title: row.title,
    subtitle: row.projects?.name ?? null,
    to: `/projects/${row.project_id}?task=${row.id}`,
    matchedTitle: matchesTitle(row.title, safe),
    updatedAt: row.updated_at,
  }));

  const noteResults: SearchResult[] = ((notes.data ?? []) as unknown as NoteRow[]).map((row) => ({
    id: row.id,
    type: "note",
    title: row.title,
    subtitle: row.note_type,
    to: `/notes?note=${row.id}`,
    matchedTitle: matchesTitle(row.title, safe),
    updatedAt: row.updated_at,
  }));

  const projectResults: SearchResult[] = ((projects.data ?? []) as unknown as ProjectRow[]).map((row) => ({
    id: row.id,
    type: "project",
    title: row.name,
    subtitle: row.status,
    to: `/projects/${row.id}`,
    matchedTitle: matchesTitle(row.name, safe),
    updatedAt: row.updated_at,
  }));

  const milestoneResults: SearchResult[] = ((milestones.data ?? []) as unknown as MilestoneRow[]).map((row) => ({
    id: row.id,
    type: "milestone",
    title: row.title,
    subtitle: null,
    to: `/milestones/${row.id}`,
    matchedTitle: matchesTitle(row.title, safe),
    updatedAt: row.updated_at,
  }));

  return rankSearchResults([...taskResults, ...noteResults, ...projectResults, ...milestoneResults]);
}
