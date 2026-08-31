import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { InlineAlert } from "../../components/inline-alert";
import { useMemo, useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { StatusPill, type StatusTone } from "../../components/status-pill";
import { supabase } from "../../lib/supabase/client";
import type { Database, ProjectPriority } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { listProjects } from "../projects/projects.queries";
import { WorkItemCardModal, type WorkItemDetailValues } from "../work-items/work-item-card-modal";
import { listDueWorkItems, updateWorkItemDetails } from "../work-items/work-items.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";
import {
  buildCalendarWeeks,
  getCalendarRange,
  getDeadlineBuckets,
  getDueDateStats,
  getMonthTitle,
  groupWorkItemsByDueDate,
  toDateKey,
} from "./calendar.utils";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];
type DeadlineMotionTone = "normal" | "today" | "urgent";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftMonth(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function priorityTone(priority: ProjectPriority): StatusTone {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "low") return "good";
  return "neutral";
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function deadlineMotionToneForBucket(label: string): DeadlineMotionTone {
  if (label === "Overdue") return "urgent";
  if (label === "Today") return "today";
  return "normal";
}

function projectName(projectsById: Map<string, Project>, item: WorkItem) {
  return projectsById.get(item.project_id)?.name ?? "Mission";
}

export function DeadlineCard({
  item,
  motionTone = "normal",
  onOpenItem,
  projectsById,
}: {
  item: WorkItem;
  motionTone?: DeadlineMotionTone;
  onOpenItem: (id: string) => void;
  projectsById: Map<string, Project>;
}) {
  return (
    <button
      className={clsx(
        "orbit-task-card grid gap-2 rounded-md border border-slate-400/15 bg-slate-950/68 p-3 text-left transition hover:border-cyan-300/35",
        motionTone === "today" && "orbit-deadline-pulse",
        motionTone === "urgent" && "orbit-deadline-pulse orbit-deadline-pulse-danger",
      )}
      onClick={() => onOpenItem(item.id)}
      type="button"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-cyan-100">{projectName(projectsById, item)}</p>
        <h3 className="mt-1 break-words text-sm font-semibold text-white">{item.title}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={priorityTone(item.priority)}>{item.priority}</StatusPill>
        <StatusPill tone="neutral">{item.status.replaceAll("_", " ")}</StatusPill>
      </div>
    </button>
  );
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const { isLoading: isAuthLoading, user } = useAuth();
  const workspaceId = useWorkspaceId();
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => {
    const today = new Date();
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
  });
  const todayKey = toDateKey(new Date());
  const calendarRange = useMemo(() => getCalendarRange(viewDate), [viewDate]);
  const calendarWeeks = useMemo(() => buildCalendarWeeks(viewDate), [viewDate]);

  const calendarQuery = useQuery({
    queryKey: ["due-calendar", workspaceId, calendarRange.startDate, calendarRange.endDate],
    queryFn: async () => {
      const [items, projects] = await Promise.all([
        listDueWorkItems(supabase, {
          workspaceId,
          startDate: calendarRange.startDate,
          endDate: calendarRange.endDate,
        }),
        listProjects(supabase, workspaceId),
      ]);

      return { items, projects };
    },
    enabled: Boolean(user),
  });

  const updateDetailsMutation = useMutation({
    mutationFn: ({ item, values }: { item: WorkItem; values: WorkItemDetailValues }) => {
      return updateWorkItemDetails(supabase, {
        id: item.id,
        workspaceId,
        projectId: item.project_id,
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: values.status,
        dueDate: values.dueDate,
        blockedReason: values.blockedReason,
        milestoneId: values.milestoneId,
        plannedAt: values.plannedAt || null,
        plannedMinutes: values.plannedMinutes ? Number(values.plannedMinutes) : null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
      setSelectedWorkItemId(null);
    },
  });

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading deadline calendar" message="Checking your session before plotting upcoming work." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to view your deadline calendar." />;
  }

  const items = calendarQuery.data?.items ?? [];
  const projects = calendarQuery.data?.projects ?? [];
  const itemsByDueDate = groupWorkItemsByDueDate(items);
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const stats = getDueDateStats(items, todayKey);
  const buckets = getDeadlineBuckets(items, todayKey);
  const selectedWorkItem = items.find((item) => item.id === selectedWorkItemId) ?? null;
  const agendaItems = [...items].sort((a, b) => {
    const dateDelta = (a.due_date ?? "").localeCompare(b.due_date ?? "");
    if (dateDelta !== 0) return dateDelta;
    return a.title.localeCompare(b.title);
  });

  return (
    <section className="grid gap-5">
      <div className="orbit-panel overflow-hidden rounded-lg p-5 sm:p-6">
        <div className="relative z-10 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <p className="mission-label">Launch windows</p>
            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Deadline Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Track due dates across every mission and keep the next launch window in view.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[24rem]">
            <div className="telemetry-chip rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-400">Overdue</p>
              <p className="mt-1 text-2xl font-black text-rose-100">{stats.overdue}</p>
            </div>
            <div className="telemetry-chip rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-400">Today</p>
              <p className="mt-1 text-2xl font-black text-cyan-100">{stats.dueToday}</p>
            </div>
            <div className="telemetry-chip rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-400">Upcoming</p>
              <p className="mt-1 text-2xl font-black text-violet-100">{stats.upcoming}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="orbit-panel-soft overflow-hidden rounded-lg">
          <header className="flex flex-col gap-3 border-b border-slate-400/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                <CalendarDays size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Orbit view</p>
                <h2 className="text-xl font-black text-white">{getMonthTitle(viewDate)}</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="orbit-button-secondary px-3" onClick={() => setViewDate(shiftMonth(viewDate, -1))} type="button">
                <ChevronLeft size={16} aria-hidden="true" />
                <span className="sr-only">Previous month</span>
              </button>
              <button className="orbit-button-secondary" onClick={() => setViewDate(shiftMonth(new Date(), 0))} type="button">
                Today
              </button>
              <button className="orbit-button-secondary px-3" onClick={() => setViewDate(shiftMonth(viewDate, 1))} type="button">
                <ChevronRight size={16} aria-hidden="true" />
                <span className="sr-only">Next month</span>
              </button>
            </div>
          </header>

          {calendarQuery.isPending ? (
            <div className="p-4">
              <EmptyState isLoading title="Plotting deadlines" message="Loading the current calendar window." />
            </div>
          ) : null}

          {calendarQuery.isError ? (
            <div className="p-4">
              <EmptyState title="Could not load calendar" message={calendarQuery.error.message} />
            </div>
          ) : null}

          {!calendarQuery.isPending && !calendarQuery.isError ? (
            <div className="p-3">
              <div className="grid grid-cols-7 border-b border-slate-400/15 pb-2 text-center text-xs font-bold uppercase text-slate-500">
                {weekdays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarWeeks.flat().map((day) => {
                  const dayItems = itemsByDueDate.get(day.dateKey) ?? [];

                  return (
                    <article
                      className={`grid min-h-28 content-start gap-2 rounded-lg border p-2 ${
                        day.isToday
                          ? "daily-orbit-pulse border-cyan-300/45 bg-cyan-300/10"
                          : "border-slate-400/12 bg-slate-950/46"
                      } ${day.isCurrentMonth ? "" : "opacity-45"}`}
                      key={day.dateKey}
                    >
                      <time className="text-xs font-black text-slate-300" dateTime={day.dateKey}>
                        {day.dayOfMonth}
                      </time>
                      {dayItems.slice(0, 3).map((item) => (
                        <button
                          className="truncate rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2 py-1 text-left text-xs font-semibold text-cyan-50 hover:border-cyan-300/35"
                          key={item.id}
                          onClick={() => {
                            updateDetailsMutation.reset();
                            setSelectedWorkItemId(item.id);
                          }}
                          title={item.title}
                          type="button"
                        >
                          {item.title}
                        </button>
                      ))}
                      {dayItems.length > 3 ? (
                        <span className="text-xs font-semibold text-slate-500">+{dayItems.length - 3} more</span>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="orbit-panel-soft rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-violet-300/20 bg-violet-300/10 text-violet-100">
              <Rocket size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Upcoming burn list</p>
              <h2 className="text-lg font-black text-white">Due work</h2>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {agendaItems.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-400/20 bg-slate-950/42 px-3 py-6 text-center text-sm text-slate-400">
                No due dates in this calendar window.
              </p>
            ) : null}

            {[
              ["Overdue", buckets.overdue],
              ["Today", buckets.today],
              ["This week", buckets.thisWeek],
              ["Later", buckets.later],
            ].map(([label, bucketItems]) =>
              (bucketItems as WorkItem[]).length > 0 ? (
                <section className="grid gap-2" key={label as string}>
                  <h3 className="text-xs font-bold uppercase text-slate-500">{label as string}</h3>
                  {(bucketItems as WorkItem[]).map((item) => (
                    <div key={item.id} className="grid gap-2">
                      {item.due_date ? (
                        <time className="text-xs font-bold uppercase text-slate-500" dateTime={item.due_date}>
                          {formatDueDate(item.due_date)}
                        </time>
                      ) : null}
                      <DeadlineCard
                        item={item}
                        motionTone={deadlineMotionToneForBucket(label as string)}
                        onOpenItem={setSelectedWorkItemId}
                        projectsById={projectsById}
                      />
                    </div>
                  ))}
                </section>
              ) : null,
            )}
          </div>
        </aside>
      </div>

      {selectedWorkItem ? (
        <WorkItemCardModal
          isSubmitting={updateDetailsMutation.isPending}
          item={selectedWorkItem}
          onClose={() => setSelectedWorkItemId(null)}
          onSubmit={(values) => updateDetailsMutation.mutate({ item: selectedWorkItem, values })}
        />
      ) : null}

      {updateDetailsMutation.isError ? (
        <InlineAlert className="fixed bottom-4 right-4 z-50" tone="error">
          {updateDetailsMutation.error.message}
        </InlineAlert>
      ) : null}
    </section>
  );
}
