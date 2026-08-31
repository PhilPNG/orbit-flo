import { InlineAlert } from "../../components/inline-alert";
import { Topography } from "../../components/topography";
import { AlertTriangle, Check, Copy, Plus, Star } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/empty-state";
import { Modal } from "../../components/modal";
import { supabase } from "../../lib/supabase/client";
import type { LinkType, WorkItemStatus } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { createMeetingNote, convertMeetingActionItemToTask, listMeetingActionItems, listMeetingNotes, type MeetingNoteValues } from "../meetings/meeting-notes.queries";
import { getDeadlineBuckets, toDateKey } from "../calendar/calendar.utils";
import { createLaunchChecklist, listLaunchChecklists, updateLaunchChecklist, type LaunchChecklistValues } from "./launch-checklist.queries";
import type { MilestoneFormValues, MilestoneUpdateValues } from "./milestone-manager";
import { createMilestone, listProjectMilestones, updateMilestone } from "./milestones.queries";
import { getProjectBrief, upsertProjectBrief, type ProjectBriefValues } from "./project-brief.queries";
import { getProject, updateProjectFavorite } from "./projects.queries";
import { listMembers, membersQueryKey } from "../members/members.queries";
import { ProjectBriefPanel } from "./project-brief-panel";
import { ProjectLinksPanel } from "./project-links-panel";
import {
  createProjectLink,
  deleteProjectLink,
  listProjectLinks,
  updateProjectLink,
} from "./project-links.queries";
import { ProjectRitualsPanel } from "./project-rituals-panel";
import { RecurringTasksPanel } from "../recurrence/recurring-tasks-panel";
import { projectRitualsKeys, updateProjectRitualsTitle } from "./project-rituals.queries";
import { TemplatesPanel, type TemplateWorkItem } from "./project-rituals-templates";
import {
  incrementTemplateUsage,
  listTemplateUsage,
  templateSlug,
  templateUsageKeys,
} from "./template-usage.queries";
import { loadWorkspacePanels, saveWorkspacePanels, type WorkspacePanels } from "./workspace-panels";
import {
  boardColumnsKeys,
  createBoardColumn,
  deleteBoardColumn,
  ensureDefaultBoardColumns,
  moveWorkItemToColumn,
  renameBoardColumn,
  reorderBoardColumns,
  type BoardColumn,
} from "../work-items/board-columns.queries";
import { KanbanBoard } from "../work-items/kanban-board";
import {
  assignLabel,
  createChecklistItem,
  getWorkItemMeta,
  listProjectLabels,
  uploadAttachment,
  workItemDetailsKeys,
} from "../work-items/work-item-details.queries";
import { WorkItemCardModal, type WorkItemDetailValues } from "../work-items/work-item-card-modal";
import { WorkItemForm, type WorkItemFormValues } from "../work-items/work-item-form";
import { createWorkItem, listWorkItems, updateWorkItemDetails, updateWorkItemStatus } from "../work-items/work-items.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";

const tabs = ["Board", "Tasks", "Timeline", "Meetings", "Launch", "Maps", "Notes", "Review"] as const;

type WorkspaceTab = (typeof tabs)[number];

const loadLaunchChecklistPanel = () =>
  import("./launch-checklist-panel").then((module) => ({ default: module.LaunchChecklistPanel }));
const loadMapsPage = () => import("../maps/maps-page").then((module) => ({ default: module.MapsPage }));
const loadMeetingNotesPanel = () =>
  import("../meetings/meeting-notes-panel").then((module) => ({ default: module.MeetingNotesPanel }));
const loadMilestoneManager = () => import("./milestone-manager").then((module) => ({ default: module.MilestoneManager }));
const loadNotesPage = () => import("../notes/notes-page").then((module) => ({ default: module.NotesPage }));
const loadProjectTimeline = () => import("./project-timeline").then((module) => ({ default: module.ProjectTimeline }));
const loadReviewsPanel = () => import("../reviews/reviews-panel").then((module) => ({ default: module.ReviewsPanel }));
const loadTaskListView = () => import("../work-items/task-list-view").then((module) => ({ default: module.TaskListView }));

const LaunchChecklistPanel = lazy(loadLaunchChecklistPanel);
const MapsPage = lazy(loadMapsPage);
const MeetingNotesPanel = lazy(loadMeetingNotesPanel);
const MilestoneManager = lazy(loadMilestoneManager);
const NotesPage = lazy(loadNotesPage);
const ProjectTimeline = lazy(loadProjectTimeline);
const ReviewsPanel = lazy(loadReviewsPanel);
const TaskListView = lazy(loadTaskListView);

function TabFallback() {
  return <EmptyState isLoading title="Loading workspace section" message="Preparing this project view." />;
}

function DeadlineRadar({ items }: { items: Awaited<ReturnType<typeof listWorkItems>> }) {
  const buckets = getDeadlineBuckets(items, toDateKey(new Date()));
  const urgentItems = [...buckets.overdue, ...buckets.today, ...buckets.thisWeek].slice(0, 4);

  if (urgentItems.length === 0) return null;

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-violet-300/25 bg-violet-300/10 text-violet-100">
          <AlertTriangle size={17} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400">Deadline radar</p>
          <h2 className="text-base font-black text-white">
            {buckets.overdue.length} overdue, {buckets.today.length} due today
          </h2>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {urgentItems.map((item) => (
          <span
            className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-50"
            key={item.id}
          >
            {item.title}
          </span>
        ))}
      </div>
    </section>
  );
}

export function ProjectWorkspacePage() {
  const { projectId } = useParams();
  const { isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Board");
  const [isMineOnly, setIsMineOnly] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [panels, setPanels] = useState<WorkspacePanels>(() => loadWorkspacePanels(projectId ?? ""));
  const [isIdCopied, setIsIdCopied] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  async function copyProjectId() {
    if (!projectId) return;
    await navigator.clipboard.writeText(projectId);
    setIsIdCopied(true);
    window.setTimeout(() => setIsIdCopied(false), 2000);
  }

  useEffect(() => {
    setPanels(loadWorkspacePanels(projectId ?? ""));
  }, [projectId]);

  function updatePanels(next: WorkspacePanels) {
    setPanels(next);
    if (projectId) saveWorkspacePanels(projectId, next);
  }
  const workItemsQueryKey = ["work-items", workspaceId, projectId] as const;
  const milestonesQueryKey = ["milestones", workspaceId, projectId] as const;
  const projectBriefQueryKey = ["project-brief", workspaceId, projectId] as const;
  const projectLinksQueryKey = ["project-links", workspaceId, projectId] as const;
  const launchChecklistsQueryKey = ["launch-checklists", workspaceId, projectId] as const;
  const meetingNotesQueryKey = ["meeting-notes", workspaceId, projectId] as const;
  const meetingActionItemsQueryKey = ["meeting-action-items", workspaceId, projectId] as const;
  const shouldLoadMilestones = activeTab === "Timeline" || selectedWorkItemId !== null;
  const shouldLoadLaunchChecklist = activeTab === "Launch";
  const shouldLoadMeetings = activeTab === "Meetings";

  const workItemsQuery = useQuery({
    queryKey: workItemsQueryKey,
    queryFn: () => listWorkItems(supabase, workspaceId, projectId ?? ""),
    enabled: Boolean(projectId && user),
  });

  const milestonesQuery = useQuery({
    queryKey: milestonesQueryKey,
    queryFn: () => listProjectMilestones(supabase, workspaceId, projectId ?? ""),
    enabled: Boolean(projectId && user && shouldLoadMilestones),
  });

  const projectBriefQuery = useQuery({
    queryKey: projectBriefQueryKey,
    queryFn: () => getProjectBrief(supabase, workspaceId, projectId ?? ""),
    enabled: Boolean(projectId && user),
  });

  const membersQuery = useQuery({
    queryKey: membersQueryKey(workspaceId),
    queryFn: () => listMembers(supabase, workspaceId),
    enabled: Boolean(workspaceId && user),
  });

  const assigneeNames = new Map(
    (membersQuery.data ?? []).map((member) => [member.userId, member.displayName]),
  );

  const projectLinksQuery = useQuery({
    queryKey: projectLinksQueryKey,
    queryFn: () => listProjectLinks(supabase, { workspaceId, projectId: projectId ?? "" }),
    enabled: Boolean(projectId && user),
  });

  const launchChecklistsQuery = useQuery({
    queryKey: launchChecklistsQueryKey,
    queryFn: () => listLaunchChecklists(supabase, workspaceId, projectId ?? ""),
    enabled: Boolean(projectId && user && shouldLoadLaunchChecklist),
  });

  const meetingNotesQuery = useQuery({
    queryKey: meetingNotesQueryKey,
    queryFn: () => listMeetingNotes(supabase, workspaceId, projectId ?? ""),
    enabled: Boolean(projectId && user && shouldLoadMeetings),
  });

  const meetingActionItemsQuery = useQuery({
    queryKey: meetingActionItemsQueryKey,
    queryFn: () => listMeetingActionItems(supabase, workspaceId, projectId ?? ""),
    enabled: Boolean(projectId && user && shouldLoadMeetings),
  });

  const createWorkItemMutation = useMutation({
    mutationFn: async (values: WorkItemFormValues) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before creating work items.");
      }

      const created = await createWorkItem(supabase, {
        workspaceId,
        projectId,
        userId: user.id,
        title: values.title,
        description: values.description,
        dueDate: values.dueDate,
        priority: values.priority,
        status: values.status,
      });

      await Promise.all(
        values.labelIds.map((labelId) =>
          assignLabel(supabase, { workspaceId, workItemId: created.id, labelId }),
        ),
      );

      for (const [index, title] of values.checklistItems.entries()) {
        await createChecklistItem(supabase, {
          workspaceId,
          workItemId: created.id,
          userId: user.id,
          title,
          sortOrder: index,
        });
      }

      for (const file of values.files) {
        await uploadAttachment(supabase, { workspaceId, workItemId: created.id, userId: user.id, file });
      }

      return created;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workItemsQueryKey });
      await queryClient.invalidateQueries({ queryKey: workItemDetailsKeys.meta(workspaceId, projectId ?? "") });
      await queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
      setIsCreateOpen(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkItemStatus }) => {
      if (!projectId) {
        throw new Error("Choose a workspace before updating work items.");
      }

      return updateWorkItemStatus(supabase, {
        id,
        workspaceId,
        projectId,
        status,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workItemsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
    },
  });

  const projectQuery = useQuery({
    queryKey: ["project", workspaceId, projectId],
    queryFn: () => getProject(supabase, workspaceId, projectId ?? ""),
    enabled: Boolean(projectId && user),
  });

  const templateUsageQuery = useQuery({
    queryKey: templateUsageKeys.workspace(workspaceId),
    queryFn: () => listTemplateUsage(supabase, workspaceId),
    enabled: Boolean(user),
  });

  const templateUseCounts = new Map(
    (templateUsageQuery.data ?? []).map((row) => [row.template_id, row.use_count] as const),
  );

  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) => {
      if (!projectId) throw new Error("Project context is required.");
      return updateProjectFavorite(supabase, { id: projectId, workspaceId, isFavorite });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project", workspaceId, projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });

  const projectLabelsQuery = useQuery({
    queryKey: workItemDetailsKeys.labels(workspaceId, projectId ?? ""),
    queryFn: () => listProjectLabels(supabase, { workspaceId, projectId: projectId ?? "" }),
    enabled: Boolean(projectId && user),
  });

  const renameRitualsTitleMutation = useMutation({
    mutationFn: (ritualsTitle: string) => {
      if (!projectId) throw new Error("Choose a workspace before renaming rituals.");
      return updateProjectRitualsTitle(supabase, { workspaceId, projectId, ritualsTitle });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project", workspaceId, projectId] });
      await queryClient.invalidateQueries({ queryKey: projectRitualsKeys.list(workspaceId, projectId ?? "") });
    },
  });

  const loadedWorkItemIds = (workItemsQuery.data ?? []).map((item) => item.id);
  const metaQuery = useQuery({
    queryKey: workItemDetailsKeys.meta(workspaceId, projectId ?? ""),
    queryFn: () => getWorkItemMeta(supabase, { workspaceId, workItemIds: loadedWorkItemIds }),
    enabled: Boolean(projectId && user && loadedWorkItemIds.length > 0),
  });

  const boardColumnsQueryKey = boardColumnsKeys.list(workspaceId, projectId ?? "");
  const boardColumnsQuery = useQuery({
    queryKey: boardColumnsQueryKey,
    queryFn: () =>
      ensureDefaultBoardColumns(supabase, {
        workspaceId,
        projectId: projectId ?? "",
        userId: user?.id ?? "",
      }),
    enabled: Boolean(projectId && user),
  });

  const moveItemMutation = useMutation({
    mutationFn: ({ id, column }: { id: string; column: BoardColumn }) => {
      if (!projectId) {
        throw new Error("Choose a workspace before moving work items.");
      }

      return moveWorkItemToColumn(supabase, {
        id,
        workspaceId,
        projectId,
        columnId: column.id,
        statusCategory: column.status_category,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workItemsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
    },
  });

  const renameColumnMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => {
      return renameBoardColumn(supabase, { id, workspaceId, title });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey });
    },
  });

  const addColumnMutation = useMutation({
    mutationFn: ({ title, statusCategory }: { title: string; statusCategory: WorkItemStatus }) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before adding columns.");
      }

      return createBoardColumn(supabase, {
        workspaceId,
        projectId,
        userId: user.id,
        title,
        statusCategory,
        sortOrder: boardColumnsQuery.data?.length ?? 0,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: ({ column, moveItemsTo }: { column: BoardColumn; moveItemsTo?: BoardColumn }) => {
      return deleteBoardColumn(supabase, {
        id: column.id,
        workspaceId,
        moveItemsTo: moveItemsTo
          ? { columnId: moveItemsTo.id, statusCategory: moveItemsTo.status_category }
          : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey });
      await queryClient.invalidateQueries({ queryKey: workItemsQueryKey });
    },
  });

  const reorderColumnsMutation = useMutation({
    mutationFn: (orderedIds: string[]) => {
      if (!projectId) {
        throw new Error("Choose a workspace before reordering columns.");
      }
      return reorderBoardColumns(supabase, { workspaceId, projectId, orderedIds });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey });
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: WorkItemDetailValues }) => {
      if (!projectId) {
        throw new Error("Choose a workspace before updating work items.");
      }

      return updateWorkItemDetails(supabase, {
        id,
        workspaceId,
        projectId,
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
      await queryClient.invalidateQueries({ queryKey: workItemsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
      setSelectedWorkItemId(null);
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: (values: MilestoneFormValues) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before creating milestones.");
      }

      return createMilestone(supabase, {
        workspaceId,
        projectId,
        userId: user.id,
        title: values.title,
        description: values.description,
        targetDate: values.targetDate,
        sortOrder: milestonesQuery.data?.length ?? 0,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milestonesQueryKey });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: MilestoneUpdateValues }) => {
      if (!projectId) {
        throw new Error("Choose a workspace before updating milestones.");
      }

      return updateMilestone(supabase, {
        id,
        workspaceId,
        projectId,
        title: values.title,
        description: values.description,
        targetDate: values.targetDate,
        completedAt: values.completedAt,
        sortOrder: values.sortOrder,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milestonesQueryKey });
    },
  });

  const saveProjectBriefMutation = useMutation({
    mutationFn: (values: ProjectBriefValues) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before saving the brief.");
      }

      return upsertProjectBrief(supabase, { ...values, workspaceId, projectId, userId: user.id });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectBriefQueryKey });
    },
  });

  const createProjectLinkMutation = useMutation({
    mutationFn: (values: { linkType: LinkType; label: string; url: string }) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before adding links.");
      }

      return createProjectLink(supabase, { ...values, workspaceId, projectId, userId: user.id });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectLinksQueryKey });
    },
  });

  const updateProjectLinkMutation = useMutation({
    mutationFn: (values: { id: string; linkType: LinkType; label: string; url: string }) => {

      return updateProjectLink(supabase, { ...values, workspaceId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectLinksQueryKey });
    },
  });

  const deleteProjectLinkMutation = useMutation({
    mutationFn: (id: string) => {

      return deleteProjectLink(supabase, { id, workspaceId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: projectLinksQueryKey });
    },
  });

  const saveLaunchChecklistMutation = useMutation({
    mutationFn: (values: LaunchChecklistValues) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before saving the launch checklist.");
      }

      const existingChecklist = launchChecklistsQuery.data?.[0] ?? null;
      if (existingChecklist) {
        return updateLaunchChecklist(supabase, {
          ...values,
          id: existingChecklist.id,
          workspaceId,
          projectId,
        });
      }

      return createLaunchChecklist(supabase, {
        ...values,
        workspaceId,
        projectId,
        userId: user.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: launchChecklistsQueryKey });
    },
  });

  const saveMeetingNoteMutation = useMutation({
    mutationFn: (values: MeetingNoteValues) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before saving meeting notes.");
      }

      return createMeetingNote(supabase, {
        ...values,
        workspaceId,
        projectId,
        userId: user.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meetingNotesQueryKey });
      await queryClient.invalidateQueries({ queryKey: meetingActionItemsQueryKey });
    },
  });

  const convertMeetingActionItemMutation = useMutation({
    mutationFn: (id: string) => {
      if (!projectId || !user) {
        throw new Error("Choose a workspace before converting meeting action items.");
      }

      return convertMeetingActionItemToTask(supabase, {
        id,
        workspaceId,
        projectId,
        userId: user.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meetingActionItemsQueryKey });
      await queryClient.invalidateQueries({ queryKey: workItemsQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["due-calendar"] });
    },
  });

  useEffect(() => {
    saveProjectBriefMutation.reset();
    saveLaunchChecklistMutation.reset();
    saveMeetingNoteMutation.reset();
    convertMeetingActionItemMutation.reset();
  }, [projectId, workspaceId]);

  // Opens the task named by a search deep link. Kept above the early returns
  // below; a hook placed after a guard has crashed this page before.
  const requestedTaskId = searchParams.get("task");

  useEffect(() => {
    if (!requestedTaskId || workItemsQuery.isPending) return;

    if ((workItemsQuery.data ?? []).some((item) => item.id === requestedTaskId)) {
      setSelectedWorkItemId(requestedTaskId);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("task");
    setSearchParams(next, { replace: true });
  }, [requestedTaskId, workItemsQuery.data, workItemsQuery.isPending, searchParams, setSearchParams]);

  function openCreateModal() {
    createWorkItemMutation.reset();
    setIsCreateOpen(true);
  }

  function applyTemplate(items: TemplateWorkItem[], name: string) {
    if (workspaceId) {
      void incrementTemplateUsage(supabase, { workspaceId, templateId: templateSlug(name) })
        .then(() => queryClient.invalidateQueries({ queryKey: templateUsageKeys.workspace(workspaceId) }))
        .catch(() => undefined);
    }
    items.forEach((item) => {
      createWorkItemMutation.mutate({
        title: item.title,
        description: item.description,
        dueDate: "",
        priority: item.priority,
        status: item.status,
        labelIds: [],
        checklistItems: [],
        files: [],
      });
    });
  }

  function prefetchWorkspaceTab(tab: WorkspaceTab) {
    const canPrefetchProjectData = Boolean(projectId && user);

    if (tab === "Tasks") {
      void loadTaskListView();
      return;
    }

    if (tab === "Timeline") {
      void loadMilestoneManager();
      void loadProjectTimeline();
      if (canPrefetchProjectData) {
        void queryClient.prefetchQuery({
          queryKey: milestonesQueryKey,
          queryFn: () => listProjectMilestones(supabase, workspaceId as string, projectId as string),
        });
      }
      return;
    }

    if (tab === "Meetings") {
      void loadMeetingNotesPanel();
      if (canPrefetchProjectData) {
        void queryClient.prefetchQuery({
          queryKey: meetingNotesQueryKey,
          queryFn: () => listMeetingNotes(supabase, workspaceId as string, projectId as string),
        });
        void queryClient.prefetchQuery({
          queryKey: meetingActionItemsQueryKey,
          queryFn: () => listMeetingActionItems(supabase, workspaceId as string, projectId as string),
        });
      }
      return;
    }

    if (tab === "Launch") {
      void loadLaunchChecklistPanel();
      if (canPrefetchProjectData) {
        void queryClient.prefetchQuery({
          queryKey: launchChecklistsQueryKey,
          queryFn: () => listLaunchChecklists(supabase, workspaceId as string, projectId as string),
        });
      }
      return;
    }

    if (tab === "Maps") {
      void loadMapsPage();
      return;
    }

    if (tab === "Notes") {
      void loadNotesPage();
      return;
    }

    if (tab === "Review") {
      void loadReviewsPanel();
    }
  }

  if (!projectId) {
    return <EmptyState title="Mission not found" message="Open a project from the mission registry." />;
  }

  if (isAuthLoading) {
    return <EmptyState isLoading title="Loading mission workspace" message="Checking your session before loading work items." />;
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to view this mission workspace." />;
  }

  const allWorkItems = workItemsQuery.data ?? [];
  const workItems = isMineOnly
    ? allWorkItems.filter((item) => item.assigned_to === user?.id)
    : allWorkItems;
  const mineCount = allWorkItems.filter((item) => item.assigned_to === user?.id).length;
  const selectedWorkItem = workItems.find((item) => item.id === selectedWorkItemId) ?? null;

  return (
    <section className="grid gap-5">
      <Topography />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Mission workspace</h1>
          <p className="mt-1 break-all text-xs text-slate-500">Project ID: {projectId}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="Copy project ID"
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-400/20 text-slate-400 transition hover:text-cyan-100"
            onClick={() => void copyProjectId()}
            type="button"
          >
            {isIdCopied ? (
              <Check aria-hidden="true" className="h-4 w-4 text-emerald-300" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
          <button
            aria-label={projectQuery.data?.is_favorite ? "Unfavorite mission" : "Favorite mission"}
            aria-pressed={projectQuery.data?.is_favorite ?? false}
            className="grid h-9 w-9 place-items-center rounded-md border border-slate-400/20 text-slate-400 transition hover:text-amber-200"
            disabled={favoriteMutation.isPending || !projectQuery.data}
            onClick={() => favoriteMutation.mutate(!(projectQuery.data?.is_favorite ?? false))}
            type="button"
          >
            <Star
              aria-hidden="true"
              className={projectQuery.data?.is_favorite ? "h-4 w-4 fill-amber-300 text-amber-300" : "h-4 w-4"}
            />
          </button>
          <button
            className="orbit-button shrink-0"
            onClick={openCreateModal}
            type="button"
          >
            <Plus size={16} />
            Launch task
          </button>
        </div>
      </div>

      {projectBriefQuery.isError ? (
        <InlineAlert tone="error">
          <span className="block">Could not load project brief</span>
          <span className="block font-medium">{projectBriefQuery.error.message}</span>
        </InlineAlert>
      ) : null}

      <ProjectBriefPanel
        key={`${workspaceId}:${projectId}`}
        brief={projectBriefQuery.data ?? null}
        isLoading={projectBriefQuery.isPending || projectBriefQuery.isError}
        isSaving={saveProjectBriefMutation.isPending}
        linksSlot={
          <ProjectLinksPanel
            errorMessage={
              createProjectLinkMutation.error?.message ??
              updateProjectLinkMutation.error?.message ??
              deleteProjectLinkMutation.error?.message ??
              projectLinksQuery.error?.message ??
              null
            }
            isLoading={projectLinksQuery.isPending}
            isSaving={
              createProjectLinkMutation.isPending ||
              updateProjectLinkMutation.isPending ||
              deleteProjectLinkMutation.isPending
            }
            links={projectLinksQuery.data ?? []}
            onCreate={(values) => createProjectLinkMutation.mutateAsync(values).then(() => undefined)}
            onDelete={(id) => deleteProjectLinkMutation.mutateAsync(id).then(() => undefined)}
            onUpdate={(id, values) =>
              updateProjectLinkMutation.mutateAsync({ id, ...values }).then(() => undefined)
            }
          />
        }
        onSave={(values) => saveProjectBriefMutation.mutateAsync(values).then(() => undefined)}
      />

      {saveProjectBriefMutation.isError ? (
        <InlineAlert tone="error">
          {saveProjectBriefMutation.error.message}
        </InlineAlert>
      ) : null}

      <div aria-label="Project workspace sections" className="flex gap-2 overflow-x-auto border-b border-slate-400/15" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={
              activeTab === tab
                ? "-mb-px shrink-0 whitespace-nowrap border-b-2 border-cyan-300 px-3 py-2 text-sm font-medium text-white"
                : "-mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            }
            key={tab}
            onClick={() => setActiveTab(tab)}
            onFocus={() => prefetchWorkspaceTab(tab)}
            onMouseEnter={() => prefetchWorkspaceTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {panels.templates || panels.rituals || panels.recurring ? (
        <section
          className={
            panels.templates && (panels.rituals || panels.recurring)
              ? "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
              : "grid gap-4"
          }
        >
          {panels.templates ? (
            <TemplatesPanel
              isApplying={createWorkItemMutation.isPending}
              onApplyTemplate={applyTemplate}
              onHide={() => updatePanels({ ...panels, templates: false })}
              useCounts={templateUseCounts}
            />
          ) : null}
          {panels.rituals && projectId && user ? (
            <ProjectRitualsPanel
              workspaceId={workspaceId}
              projectId={projectId}
              userId={user.id}
              ritualsTitle={projectQuery.data?.rituals_title ?? null}
              onRenameTitle={(title) => renameRitualsTitleMutation.mutate(title)}
              onHide={() => updatePanels({ ...panels, rituals: false })}
            />
          ) : null}
          {panels.recurring && projectId && user ? (
            <RecurringTasksPanel
              onHide={() => updatePanels({ ...panels, recurring: false })}
              projectId={projectId}
              userId={user.id}
              workspaceId={workspaceId}
            />
          ) : null}
        </section>
      ) : null}

      {!panels.templates || !panels.rituals || !panels.recurring ? (
        <div className="flex flex-wrap gap-2">
          {!panels.templates ? (
            <button
              className="orbit-button-secondary px-2.5 py-1.5 text-xs"
              onClick={() => updatePanels({ ...panels, templates: true })}
              type="button"
            >
              Show templates
            </button>
          ) : null}
          {!panels.rituals ? (
            <button
              className="orbit-button-secondary px-2.5 py-1.5 text-xs"
              onClick={() => updatePanels({ ...panels, rituals: true })}
              type="button"
            >
              Show rituals
            </button>
          ) : null}
          {!panels.recurring ? (
            <button
              className="orbit-button-secondary px-2.5 py-1.5 text-xs"
              onClick={() => updatePanels({ ...panels, recurring: true })}
              type="button"
            >
              Show recurring tasks
            </button>
          ) : null}
        </div>
      ) : null}

      <Suspense fallback={<TabFallback />}>
        {activeTab === "Board" ? (
          <div aria-label="Board" className="grid w-full min-w-0 gap-4" role="tabpanel">
          <div className="flex items-center gap-2">
            <button
              aria-pressed={isMineOnly}
              className={
                isMineOnly
                  ? "rounded-md bg-cyan-300/15 px-3 py-1.5 text-xs font-bold text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.28)]"
                  : "rounded-md px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-100"
              }
              onClick={() => setIsMineOnly((value) => !value)}
              type="button"
            >
              Assigned to me ({mineCount})
            </button>
          </div>
          {workItemsQuery.isPending || boardColumnsQuery.isPending ? (
            <EmptyState isLoading title="Loading task orbit" message="Fetching the current board." />
          ) : null}

          {workItemsQuery.isError ? (
            <EmptyState title="Could not load work items" message={workItemsQuery.error.message} />
          ) : null}

          {boardColumnsQuery.isError ? (
            <EmptyState title="Could not load board columns" message={boardColumnsQuery.error.message} />
          ) : null}

          {[moveItemMutation, renameColumnMutation, addColumnMutation, deleteColumnMutation, reorderColumnsMutation].map(
            (mutation, index) =>
              mutation.isError ? (
                <InlineAlert key={index} tone="error">
                  {mutation.error.message}
                </InlineAlert>
              ) : null,
          )}

          {!workItemsQuery.isPending && !workItemsQuery.isError && !boardColumnsQuery.isPending && !boardColumnsQuery.isError ? (
            <div className="grid w-full min-w-0 gap-4">
              <DeadlineRadar items={workItems} />
              <KanbanBoard
                  columns={boardColumnsQuery.data ?? []}
                  isUpdating={moveItemMutation.isPending}
                  items={workItems}
                  assigneeNames={assigneeNames}
                  meta={metaQuery.data}
                  onAddColumn={(title, statusCategory) => addColumnMutation.mutate({ title, statusCategory })}
                  onDeleteColumn={(column, moveItemsTo) => deleteColumnMutation.mutate({ column, moveItemsTo })}
                  onMoveItem={(id, column) => moveItemMutation.mutate({ id, column })}
                  onOpenItem={(id) => {
                    updateDetailsMutation.reset();
                    setSelectedWorkItemId(id);
                  }}
                  onRenameColumn={(id, title) => renameColumnMutation.mutate({ id, title })}
                  onReorderColumns={(orderedIds) => reorderColumnsMutation.mutate(orderedIds)}
                />
            </div>
          ) : null}
          </div>
        ) : activeTab === "Tasks" ? (
          <div aria-label="Tasks" className="grid gap-4" role="tabpanel">
          {workItemsQuery.isPending ? (
            <EmptyState isLoading title="Loading task list" message="Fetching mission tasks." />
          ) : null}

          {workItemsQuery.isError ? (
            <EmptyState title="Could not load tasks" message={workItemsQuery.error.message} />
          ) : null}

          {!workItemsQuery.isPending && !workItemsQuery.isError ? (
            <TaskListView
              isUpdating={updateStatusMutation.isPending}
              items={workItems}
              onInlineUpdate={(id, values) => {
                const item = workItems.find((workItem) => workItem.id === id);
                if (!item) return;
                updateDetailsMutation.mutate({
                  id,
                  values: {
                    title: values.title,
                    description: item.description ?? "",
                    priority: item.priority,
                    status: item.status,
                    dueDate: item.due_date ?? "",
                    milestoneId: item.milestone_id ?? "",
                    assignedTo: item.assigned_to ?? "",
                    blockedReason: item.blocked_reason ?? "",
                    plannedAt: item.planned_at?.slice(0, 5) ?? "",
                    plannedMinutes: item.planned_minutes === null ? "" : String(item.planned_minutes),
                  },
                });
              }}
              onOpenItem={(id) => {
                updateDetailsMutation.reset();
                setSelectedWorkItemId(id);
              }}
              onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
            />
          ) : null}
          </div>
        ) : activeTab === "Timeline" ? (
          <div aria-label="Timeline" className="grid gap-4" role="tabpanel">
          {workItemsQuery.isPending || milestonesQuery.isPending ? (
            <EmptyState isLoading title="Loading project timeline" message="Plotting tasks and milestones." />
          ) : null}

          {workItemsQuery.isError ? (
            <EmptyState title="Could not load tasks" message={workItemsQuery.error.message} />
          ) : null}

          {milestonesQuery.isError ? (
            <EmptyState title="Could not load milestones" message={milestonesQuery.error.message} />
          ) : null}

          {!workItemsQuery.isPending && !milestonesQuery.isPending && !workItemsQuery.isError && !milestonesQuery.isError ? (
            <>
              <MilestoneManager
                isSubmitting={createMilestoneMutation.isPending || updateMilestoneMutation.isPending}
                milestones={milestonesQuery.data ?? []}
                onCreate={(values) => createMilestoneMutation.mutate(values)}
                onUpdate={(id, values) => updateMilestoneMutation.mutate({ id, values })}
              />

              {createMilestoneMutation.isError ? (
                <InlineAlert tone="error">
                  {createMilestoneMutation.error.message}
                </InlineAlert>
              ) : null}

              {updateMilestoneMutation.isError ? (
                <InlineAlert tone="error">
                  {updateMilestoneMutation.error.message}
                </InlineAlert>
              ) : null}

              <ProjectTimeline milestones={milestonesQuery.data ?? []} workItems={workItems} />
            </>
          ) : null}
          </div>
        ) : activeTab === "Meetings" ? (
          <div aria-label="Meetings" className="grid gap-4" role="tabpanel">
          {meetingNotesQuery.isPending || meetingActionItemsQuery.isPending ? (
            <EmptyState isLoading title="Loading meeting notes" message="Gathering meeting notes and action items." />
          ) : null}

          {meetingNotesQuery.isError ? (
            <EmptyState title="Could not load meeting notes" message={meetingNotesQuery.error.message} />
          ) : null}

          {meetingActionItemsQuery.isError ? (
            <EmptyState title="Could not load meeting action items" message={meetingActionItemsQuery.error.message} />
          ) : null}

          {!meetingNotesQuery.isPending && !meetingActionItemsQuery.isPending ? (
            <MeetingNotesPanel
              actionItems={meetingActionItemsQuery.data ?? []}
              isConverting={meetingNotesQuery.isError || meetingActionItemsQuery.isError || convertMeetingActionItemMutation.isPending}
              isLoading={meetingNotesQuery.isError || meetingActionItemsQuery.isError}
              isSaving={saveMeetingNoteMutation.isPending}
              meetingNotes={meetingNotesQuery.data ?? []}
              onConvertActionItem={(id) => convertMeetingActionItemMutation.mutateAsync(id).then(() => undefined)}
              onSaveMeeting={(values) => saveMeetingNoteMutation.mutateAsync(values).then(() => undefined)}
            />
          ) : null}

          {saveMeetingNoteMutation.isError ? (
            <InlineAlert tone="error">
              {saveMeetingNoteMutation.error.message}
            </InlineAlert>
          ) : null}

          {convertMeetingActionItemMutation.isError ? (
            <InlineAlert tone="error">
              {convertMeetingActionItemMutation.error.message}
            </InlineAlert>
          ) : null}
          </div>
        ) : activeTab === "Launch" ? (
          <div aria-label="Launch" className="grid gap-4" role="tabpanel">
          {launchChecklistsQuery.isPending ? (
            <EmptyState isLoading title="Loading launch checklist" message="Checking release readiness." />
          ) : null}

          {launchChecklistsQuery.isError ? (
            <EmptyState title="Could not load launch checklist" message={launchChecklistsQuery.error.message} />
          ) : null}

          {!launchChecklistsQuery.isPending ? (
            <LaunchChecklistPanel
              checklist={launchChecklistsQuery.data?.[0] ?? null}
              isSaving={launchChecklistsQuery.isError || saveLaunchChecklistMutation.isPending}
              onSave={(values) => saveLaunchChecklistMutation.mutateAsync(values).then(() => undefined)}
            />
          ) : null}

          {saveLaunchChecklistMutation.isError ? (
            <InlineAlert tone="error">
              {saveLaunchChecklistMutation.error.message}
            </InlineAlert>
          ) : null}
          </div>
        ) : activeTab === "Maps" ? (
          <div aria-label="Maps" role="tabpanel">
            <MapsPage projectId={projectId} />
          </div>
        ) : activeTab === "Notes" ? (
          <div aria-label="Notes" role="tabpanel">
            <NotesPage projectId={projectId} />
          </div>
        ) : activeTab === "Review" ? (
          <div aria-label="Review" role="tabpanel">
            <ReviewsPanel projectId={projectId} />
          </div>
        ) : null}
      </Suspense>

      {isCreateOpen ? (
        <Modal title="Launch task" onClose={() => setIsCreateOpen(false)}>
          <WorkItemForm
            isSubmitting={createWorkItemMutation.isPending}
            labels={projectLabelsQuery.data ?? []}
            onSubmit={(values) => createWorkItemMutation.mutate(values)}
          />
          {createWorkItemMutation.isError ? (
            <p className="mt-3 text-sm text-violet-100">{createWorkItemMutation.error.message}</p>
          ) : null}
        </Modal>
      ) : null}

      {selectedWorkItem ? (
        <WorkItemCardModal
          isSubmitting={updateDetailsMutation.isPending}
          item={selectedWorkItem}
          milestones={milestonesQuery.data ?? []}
          onClose={() => setSelectedWorkItemId(null)}
          onSubmit={(values) => updateDetailsMutation.mutate({ id: selectedWorkItem.id, values })}
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
