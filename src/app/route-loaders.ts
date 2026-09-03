export const loadCalendarPage = () =>
  import("../features/calendar/calendar-page").then((module) => ({ default: module.CalendarPage }));

export const loadDashboardPage = () =>
  import("../features/dashboard/dashboard-page").then((module) => ({ default: module.DashboardPage }));

export const loadDailyMissionControlPage = () =>
  import("../features/daily/daily-mission-control-page").then((module) => ({ default: module.DailyMissionControlPage }));

export const loadInboxPage = () =>
  import("../features/inbox/inbox-page").then((module) => ({ default: module.InboxPage }));

export const loadMarketingHomePage = () =>
  import("../features/marketing/home-page").then((module) => ({ default: module.HomePage }));

export const loadFeaturesPage = () =>
  import("../features/marketing/features-page").then((module) => ({ default: module.FeaturesPage }));

export const loadAgentPage = () =>
  import("../features/marketing/agent-page").then((module) => ({ default: module.AgentPage }));

export const loadOpenSourcePage = () =>
  import("../features/marketing/open-source-page").then((module) => ({ default: module.OpenSourcePage }));

export const loadMapsLibraryRoute = () =>
  import("../features/maps/maps-routes").then((module) => ({ default: module.MapsLibraryRoute }));

export const loadMapsEditorRoute = () =>
  import("../features/maps/maps-routes").then((module) => ({ default: module.MapsEditorRoute }));

export const loadMilestonePage = () =>
  import("../features/projects/milestone-page").then((module) => ({ default: module.MilestonePage }));

export const loadNotesPage = () =>
  import("../features/notes/notes-page").then((module) => ({ default: module.NotesPage }));

export const loadProjectWorkspacePage = () =>
  import("../features/projects/project-workspace-page").then((module) => ({ default: module.ProjectWorkspacePage }));

export const loadProjectsPage = () =>
  import("../features/projects/projects-page").then((module) => ({ default: module.ProjectsPage }));

export const loadSettingsPage = () =>
  import("../features/settings/settings-page").then((module) => ({ default: module.SettingsPage }));

export const loadSignalsPage = () =>
  import("../features/signals/signals-page").then((module) => ({ default: module.SignalsPage }));

export const routePrefetchers: Record<string, () => Promise<unknown>> = {
  "/": loadDailyMissionControlPage,
  "/dashboard": loadDashboardPage,
  "/projects": loadProjectsPage,
  "/maps": loadMapsLibraryRoute,
  "/calendar": loadCalendarPage,
  "/inbox": loadInboxPage,
  "/notes": loadNotesPage,
  "/settings": loadSettingsPage,
  "/signals": loadSignalsPage,
};
