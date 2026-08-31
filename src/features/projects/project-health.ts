import type { Database, ProjectHealth, ProjectStatus } from "../../lib/supabase/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];

export interface ProjectHealthSignal {
  health: ProjectHealth;
  reason: string;
}

function daysSinceIso(isoDate: string, todayKey: string) {
  const date = new Date(isoDate);
  const today = new Date(`${todayKey}T00:00:00Z`);
  return Math.floor((today.getTime() - date.getTime()) / 86_400_000);
}

export function calculateProjectHealthSignal(
  project: Project,
  projectWorkItems: WorkItem[],
  todayKey: string,
): ProjectHealthSignal {
  const activeItems = projectWorkItems.filter((item) => item.status !== "done");

  if (activeItems.some((item) => item.status === "blocked")) {
    return {
      health: "blocked",
      reason: "Blocked work needs attention.",
    };
  }

  if (
    activeItems.some(
      (item) => item.priority === "critical" && item.due_date !== null && item.due_date < todayKey,
    )
  ) {
    return {
      health: "at_risk",
      reason: "Critical work is overdue.",
    };
  }

  if (project.status === "active" && daysSinceIso(project.updated_at, todayKey) > 21) {
    return {
      health: "watch",
      reason: "No recent project activity.",
    };
  }

  return {
    health: project.health,
    reason: project.health === "good" ? "Project orbit looks stable." : "Using saved project health.",
  };
}

const healthRank: Record<ProjectHealth, number> = { good: 0, watch: 1, at_risk: 2, blocked: 3 };
const healthWord: Record<ProjectHealth, string> = {
  good: "Nominal",
  watch: "Watch",
  at_risk: "At risk",
  blocked: "Blocked",
};

export function buildMissionStats(entries: Array<{ status: ProjectStatus; health: ProjectHealth }>) {
  const active = entries.filter((entry) => entry.status === "active").length;
  const onTrack = entries.filter((entry) => entry.health === "good").length;
  const worst = entries.reduce<ProjectHealth | null>(
    (acc, entry) => (acc === null || healthRank[entry.health] > healthRank[acc] ? entry.health : acc),
    null,
  );

  return { active, onTrack, overall: worst ? healthWord[worst] : "\u2014" };
}
