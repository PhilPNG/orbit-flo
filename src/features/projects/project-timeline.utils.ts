import type { Database } from "../../lib/supabase/database.types";

type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export type ProjectTimelineEntry =
  | {
      date: string | null;
      description: string | null;
      id: string;
      isComplete: boolean;
      priority: null;
      status: "completed" | "planned";
      title: string;
      type: "milestone";
    }
  | {
      date: string | null;
      description: string | null;
      id: string;
      isComplete: boolean;
      priority: WorkItem["priority"];
      status: WorkItem["status"];
      title: string;
      type: "task";
    };

export function buildProjectTimelineEntries({
  milestones,
  workItems,
}: {
  milestones: Milestone[];
  workItems: WorkItem[];
}): ProjectTimelineEntry[] {
  const milestoneEntries: ProjectTimelineEntry[] = milestones.map((milestone) => ({
    date: milestone.target_date,
    description: milestone.description,
    id: milestone.id,
    isComplete: Boolean(milestone.completed_at),
    priority: null,
    status: milestone.completed_at ? "completed" : "planned",
    title: milestone.title,
    type: "milestone",
  }));
  const taskEntries: ProjectTimelineEntry[] = workItems.map((item) => ({
    date: item.due_date,
    description: item.description,
    id: item.id,
    isComplete: item.status === "done",
    priority: item.priority,
    status: item.status,
    title: item.title,
    type: "task",
  }));

  return [...milestoneEntries, ...taskEntries].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    if (a.type !== b.type) return a.type === "milestone" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}
