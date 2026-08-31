import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { InlineAlert } from "../../components/inline-alert";
import { ConstellationProgress, OrbitProgressRing } from "../../components/space-visuals";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import { supabase } from "../../lib/supabase/client";
import type {
  Database,
  ProjectHealth,
  ProjectPriority,
  WorkItemStatus,
} from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import {
  DashboardWidgetCustomizer,
  defaultDashboardWidgets,
  mergeDashboardWidgets,
  type DashboardWidgetConfig,
} from "./dashboard-widget-customizer";
import {
  listDashboardWidgetPreferences,
  upsertDashboardWidgetPreferences,
} from "./dashboard-widgets.queries";
import { getDashboardData } from "./dashboard.queries";
import { formatDashboardDate, getDashboardTodayKey } from "./dashboard.utils";
import { useCountUp } from "../../lib/use-count-up";
import { toPlainText } from "../links/plain-text";
import { groupWorkItemsByRelevance } from "../work-items/work-item-relevance";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];
type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
type Note = Database["public"]["Tables"]["notes"]["Row"];

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function priorityTone(priority: ProjectPriority): StatusTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "good";
  return "neutral";
}

function healthTone(health: ProjectHealth): StatusTone {
  if (health === "good") return "good";
  if (health === "watch") return "warning";
  return "danger";
}

function statusTone(status: WorkItemStatus): StatusTone {
  if (status === "blocked") return "danger";
  if (status === "review") return "warning";
  if (status === "ready") return "good";
  return "neutral";
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="mission-label">{title}</h2>
      {children}
    </section>
  );
}

function ProjectHealthCard({ count, health }: { count: number; health: ProjectHealth }) {
  const displayCount = useCountUp(count);

  return (
    <article className="orbit-panel rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium capitalize text-slate-400">{formatLabel(health)}</p>
        <StatusPill tone={healthTone(health)}>{count}</StatusPill>
      </div>
      <p className="mt-2 text-3xl font-black text-white">{displayCount}</p>
    </article>
  );
}

function ProjectHealthSummary({ projects }: { projects: Project[] }) {
  const counts = projects.reduce(
    (summary, project) => {
      summary[project.health] += 1;
      return summary;
    },
    { good: 0, watch: 0, at_risk: 0, blocked: 0 } satisfies Record<ProjectHealth, number>,
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(counts).map(([health, count]) => (
        <ProjectHealthCard count={count} health={health as ProjectHealth} key={health} />
      ))}
    </div>
  );
}

function WorkItemRows({ isPanel = true, items }: { isPanel?: boolean; items: WorkItem[] }) {
  const workspaceId = useWorkspaceId();

  const className = isPanel
    ? "orbit-panel divide-y divide-slate-400/10 overflow-hidden rounded-lg"
    : "divide-y divide-slate-400/10";

  return (
    <ul className={className}>
      {items.map((item) => (
        <li className="grid gap-2 px-4 py-3" key={item.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <Link
              className="break-words text-sm font-semibold text-white underline-offset-2 hover:text-cyan-100 hover:underline"
              to={workspacePath(workspaceId, `/projects/${item.project_id}`)}
            >
              {item.title}
            </Link>
            <div className="flex shrink-0 flex-wrap gap-2">
              <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
              <StatusPill tone={statusTone(item.status)}>{formatLabel(item.status)}</StatusPill>
            </div>
          </div>
          {item.description ? (
            <p className="line-clamp-2 break-words text-sm text-slate-400">{toPlainText(item.description)}</p>
          ) : null}
          {item.blocked_reason ? (
            <p className="rounded-md border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-xs text-violet-100">
              {item.blocked_reason}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function WorkList({ emptyMessage, items }: { emptyMessage: string; items: WorkItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Your orbit is clear" message={emptyMessage} />;
  }

  const todayKey = getDashboardTodayKey();
  const grouped = groupWorkItemsByRelevance(items, todayKey);

  return (
    <div className="grid gap-3">
      {grouped.relevant.length > 0 ? (
        <WorkItemRows items={grouped.relevant} />
      ) : (
        <EmptyState
          title="Nothing needs attention"
          message="Lower-relevance work is waiting below when you have room."
        />
      )}

      {grouped.later.length > 0 ? (
        <details className="orbit-panel overflow-hidden rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-white">
            Later work ({grouped.later.length})
          </summary>
          <WorkItemRows isPanel={false} items={grouped.later} />
        </details>
      ) : null}
    </div>
  );
}

function MilestoneList({ milestones }: { milestones: Milestone[] }) {
  const workspaceId = useWorkspaceId();

  if (milestones.length === 0) {
    return <EmptyState title="No missions on approach" message="Milestones will appear here when projects have target dates." />;
  }

  return (
    <ul className="orbit-panel divide-y divide-slate-400/10 overflow-hidden rounded-lg">
      {milestones.map((milestone) => (
        <li
          className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          key={milestone.id}
        >
          <div className="min-w-0">
            <Link
              className="break-words text-sm font-semibold text-white underline-offset-2 hover:text-cyan-100 hover:underline"
              to={workspacePath(workspaceId, `/projects/${milestone.project_id}`)}
            >
              {milestone.title}
            </Link>
            {milestone.description ? (
              <p className="mt-1 line-clamp-2 break-words text-sm text-slate-400">{toPlainText(milestone.description)}</p>
            ) : null}
          </div>
          <time className="text-xs font-medium text-cyan-100" dateTime={milestone.target_date ?? undefined}>
            {formatDashboardDate(milestone.target_date)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function DecisionList({ decisions }: { decisions: Note[] }) {
  if (decisions.length === 0) {
    return <EmptyState title="No signal captured" message="Decision notes will appear here after they are captured." />;
  }

  return (
    <ul className="grid gap-3">
      {decisions.map((decision) => (
        <li className="orbit-panel rounded-lg p-4" key={decision.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="break-words text-sm font-semibold text-white">{decision.title}</h3>
              {decision.body ? (
                <p className="mt-2 line-clamp-3 break-words text-sm text-slate-400">{toPlainText(decision.body)}</p>
              ) : null}
            </div>
            <time className="shrink-0 text-xs text-cyan-100" dateTime={decision.updated_at}>
              {formatDashboardDate(decision.updated_at)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { isLoading: isAuthLoading, user } = useAuth();
  const workspaceId = useWorkspaceId();
  const widgetPreferencesQueryKey = ["dashboard-widget-preferences", workspaceId, user?.id];

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => getDashboardData(supabase, workspaceId),
    enabled: Boolean(user),
  });

  const widgetPreferencesQuery = useQuery({
    queryKey: widgetPreferencesQueryKey,
    queryFn: () => listDashboardWidgetPreferences(supabase, workspaceId, user?.id ?? ""),
    enabled: Boolean(user),
  });

  const widgetPreferencesMutation = useMutation({
    mutationFn: (widgets: DashboardWidgetConfig[]) =>
      upsertDashboardWidgetPreferences(supabase, {
        workspaceId,
        userId: user?.id ?? "",
        widgets: widgets.map((widget, index) => ({
          widgetKey: widget.key,
          isVisible: widget.isVisible,
          sortOrder: index,
          settings: {},
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: widgetPreferencesQueryKey });
    },
  });

  // Hooks cannot be called after a conditional return, so the mission-progress
  // count-up is derived and wired here, above the auth-gated early returns
  // below - even though the dashboard itself renders further down.
  const dashboard = dashboardQuery.data;
  const completedProjects = dashboard?.projects.filter((project) => project.status === "completed").length ?? 0;
  const totalProjects = dashboard?.projects.length ?? 0;
  const missionProgress = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;
  const displayMissionProgress = useCountUp(missionProgress);

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading mission control" message="Checking your session before loading dashboard data." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to view mission control." />;
  }

  const widgets = mergeDashboardWidgets(
    defaultDashboardWidgets,
    widgetPreferencesQuery.isError ? [] : widgetPreferencesQuery.data,
  );
  const visibleWidgets = widgets.filter((widget) => widget.isVisible);

  function renderWidget(widget: DashboardWidgetConfig) {
    if (!dashboard) return null;

    if (widget.key === "project-health") {
      return (
        <Section key={widget.key} title="Project health">
          {dashboard.projects.length > 0 ? (
            <ProjectHealthSummary projects={dashboard.projects} />
          ) : (
            <EmptyState title="No missions queued" message="Launch a project to start tracking workspace health." />
          )}
        </Section>
      );
    }

    if (widget.key === "priority-work") {
      return (
        <Section key={widget.key} title="Priority work">
          <WorkList
            emptyMessage="The highest-priority active work will appear here when a mission needs thrust."
            items={dashboard.priorityWork}
          />
        </Section>
      );
    }

    if (widget.key === "blocked-work") {
      return (
        <Section key={widget.key} title="Blocked work">
          <WorkList
            emptyMessage="Blocked work items will appear here when a mission needs attention."
            items={dashboard.blockedWork}
          />
        </Section>
      );
    }

    if (widget.key === "upcoming-milestones") {
      return (
        <Section key={widget.key} title="Upcoming milestones">
          <MilestoneList milestones={dashboard.upcomingMilestones} />
        </Section>
      );
    }

    if (widget.key === "recent-decisions") {
      return (
        <Section key={widget.key} title="Recent decisions">
          <DecisionList decisions={dashboard.recentDecisions} />
        </Section>
      );
    }

    return null;
  }

  return (
    <section className="grid gap-5">
      <div className="orbit-panel overflow-hidden rounded-lg p-5 sm:p-6">
        <p className="mission-label">Mission Control</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h1 className="text-3xl font-black text-white sm:text-4xl">Bring your work into orbit.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Cross-project work, health, milestones, and decisions in one calm flight deck.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <OrbitProgressRing label="Orbit" value={displayMissionProgress} />
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">Constellation progress</p>
              <div className="mt-3">
                <ConstellationProgress complete={completedProjects} total={totalProjects} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                {completedProjects} of {totalProjects} missions have reached orbit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {dashboardQuery.isPending ? (
        <EmptyState isLoading title="Loading mission control" message="Fetching current workspace activity." />
      ) : null}

      {dashboardQuery.isError ? (
        <EmptyState title="Could not load dashboard" message={dashboardQuery.error.message} />
      ) : null}

      {widgetPreferencesQuery.isError ? (
        <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          Widget preferences could not be loaded, so the default dashboard layout is shown.
        </p>
      ) : null}

      <DashboardWidgetCustomizer
        isDisabled={widgetPreferencesQuery.isPending || widgetPreferencesMutation.isPending}
        widgets={widgets}
        onChange={(nextWidgets) => widgetPreferencesMutation.mutate(nextWidgets)}
      />

      {widgetPreferencesMutation.isError ? (
        <InlineAlert tone="error">
          Widget preferences could not be saved.
        </InlineAlert>
      ) : null}

      {!dashboardQuery.isPending && !dashboardQuery.isError && dashboard ? (
        <>{visibleWidgets.map((widget) => renderWidget(widget))}</>
      ) : null}
    </section>
  );
}
