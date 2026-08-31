import { InlineAlert } from "../../components/inline-alert";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState } from "../../components/empty-state";
import { supabase } from "../../lib/supabase/client";
import type { CaptureType } from "../../lib/supabase/database.types";
import { useAuth } from "../auth/use-auth";
import { createNote } from "../notes/notes.queries";
import { CalendarPlanningBlocks } from "./calendar-planning-blocks";
import { loadDailyHomeLayout } from "./daily-home-layout";
import {
  addDailyPlanItem,
  completeDailyPlanItem,
  createCapture,
  getDailyMissionControlData,
  getOrCreateDailyPlan,
  resetDailyPlanItem,
  skipDailyPlanItem,
} from "./daily-plan.queries";
import { DailyReviewPanel } from "./daily-review-panel";
import { ensureRecurringOccurrences } from "../recurrence/recurrence.queries";
import { buildTodayGreeting, formatPlanDate, getSuggestedDailyWorkItems } from "./daily-plan.utils";
import { getDailyShutdown, upsertDailyShutdown } from "./daily-shutdown.queries";
import { DailyShutdownPanel } from "./daily-shutdown-panel";
import { FlightPlan } from "./flight-plan";
import { FocusSessionPanel } from "./focus-session-panel";
import { InlineSuggestions } from "./inline-suggestions";
import { MissionLog } from "./mission-log";
import { MissionMomentum } from "./mission-momentum";
import { PrivateReflectionPanel } from "./private-reflection-panel";
import { createPrivateReflection, listPrivateReflections } from "./private-reflections.queries";
import { QuickCaptureDock } from "./quick-capture-dock";
import { TodayTimeline } from "./today-timeline";
import { useWorkspaceId } from "../workspaces/workspace-context";

export function DailyMissionControlPage() {
  const { isLoading: isAuthLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [captureSuccessMessage, setCaptureSuccessMessage] = useState("");
  const [completedItemTitle, setCompletedItemTitle] = useState("");
  const [lastCompletedItemId, setLastCompletedItemId] = useState("");
  const [homeLayout] = useState(() => loadDailyHomeLayout());
  const [quickCaptureResetSignal, setQuickCaptureResetSignal] = useState(0);
  const workspaceId = useWorkspaceId();
  const planDate = formatPlanDate();
  const queryKey = ["daily-mission-control", workspaceId, planDate];
  const shutdownQueryKey = ["daily-shutdown", workspaceId, user?.id, planDate];
  const privateReflectionsQueryKey = ["private-reflections", workspaceId, user?.id];

  const missionControlQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) {
        throw new Error("Workspace and user are required to load Daily Mission Control.");
      }

      const plan = await getOrCreateDailyPlan(supabase, {
        workspaceId,
        userId: user.id,
        planDate,
      });

      const { missed } = await ensureRecurringOccurrences(supabase, workspaceId, planDate, user.id);

      // Written only when above zero: generation runs on every open, and by the
      // second run the watermark already reaches today, so missed is 0. Writing
      // that unconditionally would erase the count from the first run.
      if (missed > 0) {
        await supabase
          .from("daily_plans")
          .update({ recurring_missed_count: missed })
          .eq("id", plan.id)
          .eq("workspace_id", workspaceId);
      }

      return getDailyMissionControlData(supabase, workspaceId, planDate);
    },
    enabled: Boolean(user),
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await completeDailyPlanItem(supabase, { id, workspaceId });
      return title;
    },
    onSuccess: async (title, variables) => {
      setCompletedItemTitle(title);
      setLastCompletedItemId(variables.id);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const undoCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!lastCompletedItemId) {
        throw new Error("A completed objective is required before undoing.");
      }

      return resetDailyPlanItem(supabase, {
        id: lastCompletedItemId,
        workspaceId,
      });
    },
    onSuccess: async () => {
      setCompletedItemTitle("");
      setLastCompletedItemId("");
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (id: string) => {
      return skipDailyPlanItem(supabase, { id, workspaceId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const captureMutation = useMutation({
    mutationFn: async (values: { type: CaptureType; title: string; body: string }) => {
      if (!user) {
        throw new Error("Workspace and user are required to dock a signal.");
      }

      return createCapture(supabase, {
        workspaceId,
        userId: user.id,
        type: values.type,
        title: values.title,
        body: values.body,
      });
    },
    onSuccess: async () => {
      setCaptureSuccessMessage("Signal docked.");
      setQuickCaptureResetSignal((signal) => signal + 1);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const addSuggestedItemMutation = useMutation({
    mutationFn: async ({ workItemId, sortOrder, isPrimary }: { workItemId: string; sortOrder: number; isPrimary: boolean }) => {
      if (!missionControlQuery.data?.plan) {
        throw new Error("Daily plan is required before adding suggested work.");
      }

      return addDailyPlanItem(supabase, {
        workspaceId,
        dailyPlanId: missionControlQuery.data.plan.id,
        workItemId,
        sortOrder,
        isPrimary,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveSessionNoteMutation = useMutation({
    mutationFn: async (input: { title: string; body: string; workItemId?: string }) => {
      if (!user) {
        throw new Error("Workspace and user are required to save session notes.");
      }

      const linkedItem = missionControlQuery.data?.dailyPlanItems.find(
        (item) => item.work_item_id === input.workItemId,
      )?.workItem;

      return createNote(supabase, {
        workspaceId,
        userId: user.id,
        projectId: linkedItem?.project_id,
        workItemId: input.workItemId,
        noteType: "reference",
        title: input.title,
        body: input.body,
        tags: ["focus-session"],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes", workspaceId] });
    },
  });

  const shutdownQuery = useQuery({
    queryKey: shutdownQueryKey,
    queryFn: async () => {
      if (!user) {
        throw new Error("Workspace and user are required to load the daily shutdown.");
      }

      return getDailyShutdown(supabase, workspaceId, user.id, planDate);
    },
    enabled: Boolean(user),
  });

  const saveShutdownMutation = useMutation({
    mutationFn: async (values: {
      shipped: string;
      movedForward: string;
      blocked: string;
      resumeTomorrow: string;
    }) => {
      if (!user) {
        throw new Error("Workspace and user are required to save the daily shutdown.");
      }

      return upsertDailyShutdown(supabase, {
        ...values,
        workspaceId,
        userId: user.id,
        shutdownDate: planDate,
        dailyPlanId: missionControlQuery.data?.plan?.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shutdownQueryKey });
    },
  });

  const privateReflectionsQuery = useQuery({
    queryKey: privateReflectionsQueryKey,
    queryFn: async () => {
      if (!user) {
        throw new Error("Workspace and user are required to load private reflections.");
      }

      return listPrivateReflections(supabase, workspaceId, user.id);
    },
    enabled: Boolean(user),
  });

  const createPrivateReflectionMutation = useMutation({
    mutationFn: async (values: { title: string; body: string; mood: string }) => {
      if (!user) {
        throw new Error("Workspace and user are required to save a private reflection.");
      }

      return createPrivateReflection(supabase, {
        ...values,
        reflectionDate: planDate,
        tags: [],
        workspaceId,
        userId: user.id,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: privateReflectionsQueryKey });
    },
  });

  if (isAuthLoading) {
    return (
      <EmptyState
        isLoading
        title="Loading Daily Mission Control"
        message="Checking your session before preparing today's mission."
      />
    );
  }

  if (!user) {
    return <EmptyState title="Sign in required" message="Sign in to view Daily Mission Control." />;
  }

  const missionControl = missionControlQuery.data;
  const suggestedWorkItems = missionControl
    ? getSuggestedDailyWorkItems(missionControl.availableWorkItems, missionControl.dailyPlanItems, planDate)
    : [];
  const projectNamesById = missionControl
    ? Object.fromEntries((missionControl.projects ?? []).map((project) => [project.id, project.name]))
    : {};

  function addSuggestedWorkItem(workItemId: string, index: number) {
    addSuggestedItemMutation.mutate({
      workItemId,
      sortOrder: (missionControl?.dailyPlanItems.length ?? 0) + index,
      isPrimary: !missionControl?.dailyPlanItems.some((item) => item.is_primary),
    });
  }

  return (
    <section className="orbit-page-enter mx-auto grid w-full max-w-[44rem] gap-5">
      <header>
        <p className="text-xs font-medium text-slate-400">
          <time dateTime={planDate}>{planDate}</time>
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Today</h1>
        {(missionControl?.plan?.recurring_missed_count ?? 0) > 0 ? (
          <p className="mt-2 text-xs font-medium text-amber-200/80">
            {missionControl?.plan?.recurring_missed_count} recurring tasks were missed while you were away.
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {buildTodayGreeting(missionControl?.dailyPlanItems ?? [], suggestedWorkItems.length)}
        </p>
      </header>

      {missionControlQuery.isPending ? (
        <EmptyState
          isLoading
          title="Preparing today's orbit"
          message="Loading your plan, captures, and current mission signals."
        />
      ) : null}

      {missionControlQuery.isError ? (
        <EmptyState
          title="Could not load Daily Mission Control"
          message={missionControlQuery.error.message}
        />
      ) : null}

      {!missionControlQuery.isPending && !missionControlQuery.isError && missionControl ? (
        <>
          <FlightPlan
            completedItemTitle={completedItemTitle}
            isUpdating={completeMutation.isPending || skipMutation.isPending}
            items={missionControl.dailyPlanItems}
            onComplete={(id) => {
              const item = missionControl.dailyPlanItems.find((dailyItem) => dailyItem.id === id);
              completeMutation.mutate({ id, title: item?.workItem?.title ?? "Objective" });
            }}
            onDropWorkItemId={(workItemId) => {
              const index = suggestedWorkItems.findIndex((item) => item.id === workItemId);
              addSuggestedWorkItem(workItemId, Math.max(index, 0));
            }}
            onPullSuggested={() => {
              const [firstSuggestion] = suggestedWorkItems;
              if (firstSuggestion) addSuggestedWorkItem(firstSuggestion.id, 0);
            }}
            onSkip={(id) => skipMutation.mutate(id)}
            onUndoComplete={() => undoCompleteMutation.mutate()}
            suggestedCount={suggestedWorkItems.length}
          />

          {homeLayout.suggestions ? (
            <InlineSuggestions
              availableWorkItems={missionControl.availableWorkItems}
              dailyPlanItems={missionControl.dailyPlanItems}
              defaultExpanded={missionControl.dailyPlanItems.length === 0}
              isAdding={addSuggestedItemMutation.isPending}
              onAdd={(workItem, index) => addSuggestedWorkItem(workItem.id, index)}
              projectNamesById={projectNamesById}
              todayKey={planDate}
            />
          ) : null}

          {addSuggestedItemMutation.isError ? (
            <InlineAlert tone="error">
              {addSuggestedItemMutation.error.message}
            </InlineAlert>
          ) : null}

          {homeLayout.quickCapture ? (
            <QuickCaptureDock
              isSubmitting={captureMutation.isPending}
              onSubmit={(values) => {
                setCaptureSuccessMessage("");
                captureMutation.mutate(values);
              }}
              resetSignal={quickCaptureResetSignal}
            />
          ) : null}

          {captureSuccessMessage ? (
            <InlineAlert className="daily-capture-dock" tone="success">
              {captureSuccessMessage}
            </InlineAlert>
          ) : null}

          {captureMutation.isError ? (
            <InlineAlert tone="error">
              {captureMutation.error.message}
            </InlineAlert>
          ) : null}

          <MissionLog
            panels={{
              Focus: (
                <FocusSessionPanel
                  isUpdating={completeMutation.isPending}
                  items={missionControl.dailyPlanItems}
                  onComplete={(id) => {
                    const item = missionControl.dailyPlanItems.find((dailyItem) => dailyItem.id === id);
                    completeMutation.mutate({ id, title: item?.workItem?.title ?? "Objective" });
                  }}
                  onDropWorkItem={(workItemId) => {
                    const index = suggestedWorkItems.findIndex((item) => item.id === workItemId);
                    addSuggestedWorkItem(workItemId, Math.max(index, 0));
                  }}
                  onSaveSessionNote={(input) => saveSessionNoteMutation.mutate(input)}
                />
              ),
              Review: (
                <>
                  {homeLayout.momentum ? <MissionMomentum items={missionControl.dailyPlanItems} /> : null}
                  {homeLayout.review ? (
                    <DailyReviewPanel captures={missionControl.captures} items={missionControl.dailyPlanItems} />
                  ) : null}
                </>
              ),
              Timeline: (
                <>
                  <TodayTimeline captures={missionControl.captures} items={missionControl.dailyPlanItems} />
                  <CalendarPlanningBlocks
                    onPlanWorkItem={(workItemId, _blockId, index) => addSuggestedWorkItem(workItemId, index)}
                  />
                </>
              ),
              Shutdown: (
                <>
                  <DailyShutdownPanel
                    isDisabled={shutdownQuery.isError}
                    isLoading={shutdownQuery.isPending}
                    isSaving={saveShutdownMutation.isPending}
                    onSave={(values) => saveShutdownMutation.mutate(values)}
                    shutdown={shutdownQuery.data ?? null}
                  />
                  {shutdownQuery.isError ? (
                    <InlineAlert tone="error">
                      {shutdownQuery.error.message}
                    </InlineAlert>
                  ) : null}
                  {saveShutdownMutation.isError ? (
                    <InlineAlert tone="error">
                      {saveShutdownMutation.error.message}
                    </InlineAlert>
                  ) : null}
                </>
              ),
              Reflection: (
                <>
                  <PrivateReflectionPanel
                    isDisabled={privateReflectionsQuery.isPending || privateReflectionsQuery.isError}
                    isSaving={createPrivateReflectionMutation.isPending}
                    onCreate={(values) => createPrivateReflectionMutation.mutateAsync(values)}
                    reflections={privateReflectionsQuery.data ?? []}
                  />
                  {privateReflectionsQuery.isError ? (
                    <InlineAlert tone="error">
                      {privateReflectionsQuery.error.message}
                    </InlineAlert>
                  ) : null}
                  {createPrivateReflectionMutation.isError ? (
                    <InlineAlert tone="error">
                      {createPrivateReflectionMutation.error.message}
                    </InlineAlert>
                  ) : null}
                  {saveSessionNoteMutation.isError ? (
                    <InlineAlert tone="error">
                      {saveSessionNoteMutation.error.message}
                    </InlineAlert>
                  ) : null}
                </>
              ),
            }}
          />
        </>
      ) : null}
    </section>
  );
}
