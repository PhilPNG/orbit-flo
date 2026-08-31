import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import { SatelliteLoader } from "../components/space-visuals";
import { AuthCallbackPage } from "../features/auth/auth-callback-page";
import { AuthPage } from "../features/auth/auth-page";
import { AuthResetPage } from "../features/auth/auth-reset-page";
import { RequireAuth } from "../features/auth/require-auth";
import { InvitationPage } from "../features/invitations/invitation-page";
import { WorkspaceGate } from "../features/workspaces/workspace-gate";
import { WorkspaceRedirect } from "../features/workspaces/workspace-redirect";
import { DelayedFallback, RouteSettle } from "./route-transition";
import {
  loadCalendarPage,
  loadDailyMissionControlPage,
  loadDashboardPage,
  loadInboxPage,
  loadMapsPage,
  loadMilestonePage,
  loadNotesPage,
  loadProjectWorkspacePage,
  loadProjectsPage,
  loadSettingsPage,
  loadSignalsPage,
} from "./route-loaders";

const CalendarPage = lazy(loadCalendarPage);
const DailyMissionControlPage = lazy(loadDailyMissionControlPage);
const DashboardPage = lazy(loadDashboardPage);
const InboxPage = lazy(loadInboxPage);
const MapsPage = lazy(loadMapsPage);
const MilestonePage = lazy(loadMilestonePage);
const NotesPage = lazy(loadNotesPage);
const ProjectWorkspacePage = lazy(loadProjectWorkspacePage);
const ProjectsPage = lazy(loadProjectsPage);
const SettingsPage = lazy(loadSettingsPage);
const SignalsPage = lazy(loadSignalsPage);

const VisualReviewRoute = import.meta.env.DEV && import.meta.env.VITE_CAPTURE_MODE === "1"
  ? lazy(async () => {
      const module = await import("../dev/orbit-flo-visual-review");
      return { default: module.OrbitFloVisualReviewRoute };
    })
  : null;

export function RouteFallback() {
  return (
    <div className="orbit-loading-shell rounded-lg border border-white/10 bg-slate-950/60 px-4 py-5">
      <div className="relative z-10 grid gap-2">
        <SatelliteLoader label="Systems online" />
        <p className="text-xs font-semibold text-slate-400">Synchronizing workspace telemetry.</p>
      </div>
    </div>
  );
}

export function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DelayedFallback><RouteFallback /></DelayedFallback>}>
      <RouteSettle>{children}</RouteSettle>
    </Suspense>
  );
}

function WorkspaceLayout() {
  return (
    <RequireAuth>
      <WorkspaceGate>
        <AppShell>
          <LazyRoute>
            <Outlet />
          </LazyRoute>
        </AppShell>
      </WorkspaceGate>
    </RequireAuth>
  );
}

/** "/" and every pre-workspace path resolve to a /w/:workspaceId equivalent. */
function ResolveWorkspace() {
  return (
    <RequireAuth>
      <WorkspaceRedirect />
    </RequireAuth>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/reset" element={<AuthResetPage />} />
        {/* Unguarded: the recipient may not be signed in, or may not have an
            account yet, and still needs to see who invited them to what. */}
        <Route path="/invite/:token" element={<InvitationPage />} />
        {VisualReviewRoute ? (
          <Route
            path="/__visual/:screenId"
            element={<LazyRoute><VisualReviewRoute /></LazyRoute>}
          />
        ) : null}
        <Route element={<ResolveWorkspace />} path="/" />
        <Route element={<ResolveWorkspace />} path="/dashboard" />
        <Route element={<ResolveWorkspace />} path="/projects" />
        <Route element={<ResolveWorkspace />} path="/projects/:projectId" />
        <Route element={<ResolveWorkspace />} path="/calendar" />
        <Route element={<ResolveWorkspace />} path="/maps" />
        <Route element={<ResolveWorkspace />} path="/inbox" />
        <Route element={<ResolveWorkspace />} path="/notes" />
        <Route element={<ResolveWorkspace />} path="/settings" />
        <Route element={<ResolveWorkspace />} path="/signals" />

        <Route element={<WorkspaceLayout />} path="/w/:workspaceId">
          <Route index element={<DailyMissionControlPage />} />
          <Route element={<DashboardPage />} path="dashboard" />
          <Route element={<ProjectsPage />} path="projects" />
          <Route element={<ProjectWorkspacePage />} path="projects/:projectId" />
          <Route element={<CalendarPage />} path="calendar" />
          <Route element={<MapsPage />} path="maps" />
          <Route element={<MilestonePage />} path="milestones/:milestoneId" />
          <Route element={<InboxPage />} path="inbox" />
          <Route element={<NotesPage />} path="notes" />
          <Route element={<SettingsPage />} path="settings" />
          <Route element={<SignalsPage />} path="signals" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
