import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { EmptyState } from "../components/empty-state";
import { AuthPage } from "../features/auth/auth-page";
import { AuthStateProvider, type AuthState } from "../features/auth/use-auth";
import { invitationsQueryKey } from "../features/invitations/invitations.queries";
import { backlinksQueryKey } from "../features/links/note-links.queries";
import { unlinkedMentionsQueryKey } from "../features/links/unlinked-mentions.queries";
import { membersQueryKey } from "../features/members/members.queries";
import {
  signalsQueryKey,
  unreadByWorkspaceQueryKey,
  unreadSignalCountQueryKey,
} from "../features/signals/signals.queries";
import { WorkspaceProvider } from "../features/workspaces/workspace-context";
import { workspacesQueryKey } from "../features/workspaces/workspaces.queries";
import { DailyReviewPanel } from "../features/daily/daily-review-panel";
import { DailyShutdownPanel } from "../features/daily/daily-shutdown-panel";
import { FlightPlan } from "../features/daily/flight-plan";
import { FocusSessionPanel } from "../features/daily/focus-session-panel";
import { InlineSuggestions } from "../features/daily/inline-suggestions";
import { MissionLog } from "../features/daily/mission-log";
import { MissionMomentum } from "../features/daily/mission-momentum";
import { PrivateReflectionPanel } from "../features/daily/private-reflection-panel";
import { QuickCaptureDock } from "../features/daily/quick-capture-dock";
import { TodayTimeline } from "../features/daily/today-timeline";
import type { DailyPlanItemWithWorkItem } from "../features/daily/daily-plan.queries";
import { MapCanvas } from "../features/maps/map-canvas";
import { MapLibraryPanel } from "../features/maps/map-library-panel";
import { MapToolbar } from "../features/maps/map-toolbar";
import { NotesPage } from "../features/notes/notes-page";
import { ProjectBriefPanel } from "../features/projects/project-brief-panel";
import { ProjectRitualsPanel } from "../features/projects/project-rituals-panel";
import { projectRitualsKeys } from "../features/projects/project-rituals.queries";
import { TemplatesPanel } from "../features/projects/project-rituals-templates";
import { ProjectsPage } from "../features/projects/projects-page";
import { SettingsPage } from "../features/settings/settings-page";
import { defaultDailyHomeLayout } from "../features/daily/daily-home-layout";
import { InboxPage } from "../features/inbox/inbox-page";
import { notesKeys } from "../features/notes/notes.queries";
import { KanbanBoard } from "../features/work-items/kanban-board";
import { WorkItemCardModal } from "../features/work-items/work-item-card-modal";
import { workItemDetailsKeys } from "../features/work-items/work-item-details.queries";
import {
  pocketPupProject,
  visualAttachments,
  visualBoardColumns,
  visualBoardItems,
  visualBoardMeta,
  visualChecklist,
  visualComments,
  visualLabels,
  visualMilestones,
  visualMindMap,
  visualProjectId,
  visualRituals,
  visualScreenIds,
  visualTask,
  visualToday,
  visualTodaySuggestions,
  visualUser,
  visualWorkspaceId,
  type VisualScreenId,
} from "./orbit-flo-visual-fixtures";

const visualAuthState: AuthState = {
  isLoading: false,
  session: null,
  user: visualUser,
};

const captureStorageValues = [
  ["project-command-center:workspace-id", visualWorkspaceId],
  ["orbitflo:nav-collapsed", null],
  ["orbitflo:daily-home-layout", JSON.stringify(defaultDailyHomeLayout)],
] as const;

function VisualWorkspaceBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const previousValues = captureStorageValues.map(([key]) => [key, window.localStorage.getItem(key)] as const);
    captureStorageValues.forEach(([key, value]) => {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    });
    setReady(true);

    return () => {
      previousValues.forEach(([key, value]) => {
        if (value === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, value);
        }
      });
    };
  }, []);

  return ready ? children : null;
}

function createVisualQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  // The shell's workspace switcher reads this, so the capture route seeds it
  // rather than reaching for Supabase.
  client.setQueryData(workspacesQueryKey, [{ id: visualWorkspaceId, name: "Orbit Flo" }]);
  client.setQueryData(["profile", visualUser.id], {
    id: visualUser.id,
    displayName: "Orbit Pilot",
  });
  client.setQueryData(invitationsQueryKey(visualWorkspaceId), []);
  client.setQueryData(backlinksQueryKey(visualWorkspaceId, "task", visualTask.id), []);
  client.setQueryData(unlinkedMentionsQueryKey(visualWorkspaceId, "task", visualTask.id), []);
  client.setQueryData(membersQueryKey(visualWorkspaceId), [
    { id: "member-1", userId: visualUser.id, role: "owner", displayName: "Orbit Pilot" },
  ]);
  client.setQueryData(["inbox-captures", visualWorkspaceId], []);
  // The shell renders the Signals nav badge, the mobile More marker, and the
  // switcher dot on every screen, so all three query keys must be seeded or
  // the capture route's zero-Supabase-calls assertion fails.
  client.setQueryData(signalsQueryKey(visualWorkspaceId), []);
  client.setQueryData(unreadSignalCountQueryKey(visualWorkspaceId), 0);
  client.setQueryData(unreadByWorkspaceQueryKey, new Map());
  client.setQueryData(["projects", visualWorkspaceId], [pocketPupProject]);
  // The mission card reads its repository link from project_links now, so the
  // capture route seeds it too or it would reach for Supabase.
  client.setQueryData(
    ["project-links", "repository", visualWorkspaceId, [pocketPupProject.id]],
    new Map([[pocketPupProject.id, "https://github.com/PhilPNG/PocketPup"]]),
  );
  client.setQueryData(["workspace-work-items", visualWorkspaceId], []);
  client.setQueryData(notesKeys.workspace(visualWorkspaceId), []);
  client.setQueryData(projectRitualsKeys.list(visualWorkspaceId, visualProjectId), visualRituals);

  const detailsKey = workItemDetailsKeys.details(visualWorkspaceId, visualTask.id);
  client.setQueryData([...detailsKey, "comments"], visualComments);
  client.setQueryData([...detailsKey, "checklist"], visualChecklist);
  client.setQueryData([...detailsKey, "attachments"], visualAttachments);
  client.setQueryData([...detailsKey, "labels"], visualLabels);
  client.setQueryData(workItemDetailsKeys.labels(visualWorkspaceId, visualProjectId), visualLabels);
  client.setQueryData(workItemDetailsKeys.meta(visualWorkspaceId, visualProjectId), visualBoardMeta);

  return client;
}

function VisualProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createVisualQueryClient);

  return (
    <AuthStateProvider value={visualAuthState}>
      <QueryClientProvider client={queryClient}>
        {/* The capture route composes pages outside the /w/:workspaceId route,
            so it supplies the workspace the fixtures are keyed to. */}
        <WorkspaceProvider workspaceId={visualWorkspaceId}>{children}</WorkspaceProvider>
      </QueryClientProvider>
    </AuthStateProvider>
  );
}

function ProductScreen({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

function MapsLibraryScreen() {
  return (
    <ProductScreen>
      <div className="grid gap-6">
        <h1 className="text-3xl font-bold text-white">Visual planning workspace</h1>
        <div className="grid gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
          <MapLibraryPanel
            isCreating={false}
            onCreateBlank={() => undefined}
            onCreateFromTemplate={() => undefined}
          />
          <section className="grid min-w-0 content-start gap-3">
            <select aria-label="Open map" className="orbit-input max-w-56 px-2.5 py-1.5 text-xs" defaultValue="">
              <option value="">Open map…</option>
            </select>
            <EmptyState
              illustration="maps"
              title="Choose a visual plan"
              message="Start a blank map or pick a template to open the planning canvas."
            />
          </section>
        </div>
      </div>
    </ProductScreen>
  );
}

function MindMapScreen() {
  return (
    <ProductScreen>
      <div className="grid gap-6">
        <h1 className="text-3xl font-bold text-white">Visual planning workspace</h1>
        <div className="grid gap-4 lg:grid-cols-[288px_minmax(0,1fr)]">
          <MapLibraryPanel
            isCreating={false}
            onCreateBlank={() => undefined}
            onCreateFromTemplate={() => undefined}
          />
          <section className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Open map" className="orbit-input max-w-56 px-2.5 py-1.5 text-xs" defaultValue="feature-plan">
                <option value="feature-plan">Feature plan</option>
              </select>
              <MapToolbar
                activeView="mind_map"
                hasSelection
                isDirty
                isSaving={false}
                onAddNode={() => undefined}
                onOpenDetails={() => undefined}
                onSave={() => undefined}
                onViewChange={() => undefined}
              />
            </div>
            <MapCanvas
              graph={visualMindMap}
              selectedNodeId="feature"
              view="mind_map"
              onChange={() => undefined}
              onSelectNode={() => undefined}
            />
          </section>
        </div>
      </div>
    </ProductScreen>
  );
}

const workspaceTabs = ["Board", "Tasks", "Timeline", "Meetings", "Launch", "Maps", "Notes", "Review"];

function fakeDataTransfer() {
  const data = new Map<string, string>();
  return {
    effectAllowed: "move",
    getData(type: string) {
      return data.get(type) ?? "";
    },
    setData(type: string, value: string) {
      data.set(type, value);
    },
  };
}

function dispatchDrag(element: HTMLElement, type: "dragstart" | "dragover", dataTransfer: ReturnType<typeof fakeDataTransfer>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: 742 },
    clientY: { value: 640 },
    dataTransfer: { value: dataTransfer },
  });
  element.dispatchEvent(event);
}

function BoardComposition({ midDrag = false }: { midDrag?: boolean }) {
  const boardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!midDrag || !boardRef.current) return;

    const polishButton = boardRef.current.querySelector<HTMLElement>(
      'button[aria-label="Open Polish the release path"]',
    );
    const polishCard = polishButton?.closest<HTMLElement>("[data-kanban-card]");
    const readyColumn = boardRef.current.querySelector<HTMLElement>(
      '[aria-label="Ready to Launch column"]',
    );
    if (!polishCard || !readyColumn) return;

    const dataTransfer = fakeDataTransfer();
    dispatchDrag(polishCard, "dragstart", dataTransfer);
    let isMounted = true;
    window.queueMicrotask(() => {
      if (isMounted) dispatchDrag(readyColumn, "dragover", dataTransfer);
    });

    return () => {
      isMounted = false;
    };
  }, [midDrag]);

  return (
    <section className="grid gap-5" ref={boardRef}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Mission workspace</h1>
          <p className="mt-1 break-all text-xs text-slate-500">Project ID: {visualProjectId}</p>
        </div>
        <button className="orbit-button shrink-0" type="button">
          <Plus aria-hidden="true" size={16} />
          Launch task
        </button>
      </div>

      <ProjectBriefPanel brief={null} onSave={() => undefined} />

      <div aria-label="Project workspace sections" className="flex gap-2 overflow-x-auto border-b border-slate-400/15" role="tablist">
        {workspaceTabs.map((tab) => (
          <button
            aria-selected={tab === "Board"}
            className={tab === "Board"
              ? "-mb-px border-b-2 border-cyan-300 px-3 py-2 text-sm font-medium text-white"
              : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-400"}
            key={tab}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <TemplatesPanel onApplyTemplate={() => undefined} onHide={() => undefined} />
        <ProjectRitualsPanel
          workspaceId={visualWorkspaceId}
          projectId={visualProjectId}
          userId={visualUser.id}
          ritualsTitle={null}
          onRenameTitle={() => undefined}
          onHide={() => undefined}
        />
      </section>

      <div aria-label="Board" className="grid w-full min-w-0 gap-4" role="tabpanel">
        <KanbanBoard
          columns={visualBoardColumns}
          items={visualBoardItems}
          meta={visualBoardMeta}
          onAddColumn={() => undefined}
          onDeleteColumn={() => undefined}
          onMoveItem={() => undefined}
          onOpenItem={() => undefined}
          onRenameColumn={() => undefined}
          onReorderColumns={() => undefined}
          showAddColumn={false}
        />
      </div>
    </section>
  );
}

function TodayScreen() {
  const emptyItems: DailyPlanItemWithWorkItem[] = [];

  return (
    <ProductScreen>
      <section className="orbit-page-enter mx-auto grid w-full max-w-[44rem] gap-5">
        <header>
          <p className="text-xs font-medium text-slate-400"><time dateTime={visualToday}>{visualToday}</time></p>
          <h1 className="mt-1 text-3xl font-bold text-white">Today</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">A clear sky. 4 suggestions waiting when you're ready.</p>
        </header>
        <FlightPlan
          isUpdating={false}
          items={emptyItems}
          onComplete={() => undefined}
          onPullSuggested={() => undefined}
          onSkip={() => undefined}
          suggestedCount={4}
        />
        <InlineSuggestions
          availableWorkItems={visualTodaySuggestions}
          dailyPlanItems={emptyItems}
          defaultExpanded
          isAdding={false}
          onAdd={() => undefined}
          projectNamesById={{ [visualProjectId]: pocketPupProject.name }}
          todayKey={visualToday}
        />
        <QuickCaptureDock isSubmitting={false} onSubmit={() => undefined} resetSignal={0} />
        <MissionLog
          panels={{
            Focus: <FocusSessionPanel items={emptyItems} />,
            Review: (
              <>
                <MissionMomentum items={emptyItems} />
                <DailyReviewPanel captures={[]} items={emptyItems} />
              </>
            ),
            Timeline: <TodayTimeline captures={[]} items={emptyItems} />,
            Shutdown: (
              <DailyShutdownPanel isSaving={false} shutdown={null} onSave={() => undefined} />
            ),
            Reflection: (
              <PrivateReflectionPanel isSaving={false} reflections={[]} onCreate={async () => undefined} />
            ),
          }}
        />
      </section>
    </ProductScreen>
  );
}

function TaskModalScreen() {
  return (
    <ProductScreen>
      <BoardComposition />
      <WorkItemCardModal
        item={visualTask}
        milestones={visualMilestones}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />
    </ProductScreen>
  );
}

function renderScreen(screenId: VisualScreenId) {
  switch (screenId) {
    case "01-inbox":
      return <ProductScreen><InboxPage /></ProductScreen>;
    case "02-maps-library":
      return <MapsLibraryScreen />;
    case "03-maps-mind-map":
      return <MindMapScreen />;
    case "04-missions":
      return <ProductScreen><ProjectsPage /></ProductScreen>;
    case "05-auth":
      return <AuthPage />;
    case "06-brainstorm":
      return <ProductScreen><NotesPage /></ProductScreen>;
    case "07-settings":
      return <ProductScreen><SettingsPage /></ProductScreen>;
    case "08-mission-workspace-board":
      return <ProductScreen><BoardComposition midDrag /></ProductScreen>;
    case "09-today":
      return <TodayScreen />;
    case "10-task-card-modal":
      return <TaskModalScreen />;
  }
}

export function OrbitFloVisualReview({ screenId }: { screenId: VisualScreenId }) {
  return (
    <div data-testid={`visual-${screenId}`} className="visual-review-screen min-h-screen">
      <VisualWorkspaceBoundary>
        <VisualProviders>
          {renderScreen(screenId)}
        </VisualProviders>
      </VisualWorkspaceBoundary>
    </div>
  );
}

export function OrbitFloVisualReviewRoute() {
  const { screenId } = useParams();
  if (!visualScreenIds.includes(screenId as VisualScreenId)) return <Navigate replace to="/" />;
  return <OrbitFloVisualReview screenId={screenId as VisualScreenId} />;
}
