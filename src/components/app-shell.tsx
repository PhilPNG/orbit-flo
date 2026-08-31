import {
  Brain,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  Network,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  Rocket,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { routePrefetchers } from "../app/route-loaders";
import { SignalCountBadge, useUnreadSignalCount } from "../features/signals/signal-badge";
import { useWorkspaceId } from "../features/workspaces/workspace-context";
import { useAgentTools } from "../features/agent/use-agent-tools";
import { workspacePath } from "../features/workspaces/workspace-path";
import { WorkspaceSwitcher } from "../features/workspaces/workspace-switcher";
import { CommandPalette } from "./command-palette";
import { GlobalQuickAdd } from "./global-quick-add";
import { loadNavCollapsed, saveNavCollapsed } from "./nav-collapse";
import { MobileCaptureButton } from "./mobile-capture-button";
import { MobileMoreSheet } from "./mobile-more-sheet";
import { MobileTabBar } from "./mobile-tab-bar";
import { OrbitFloLogo } from "./orbit-flo-logo";
import { StarFieldBackground } from "./space-visuals";

type NavItem = { to: string; label: string; Icon: LucideIcon };

const primaryNavItems: NavItem[] = [
  { to: "/", label: "Today", Icon: Orbit },
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/projects", label: "Missions", Icon: Rocket },
  { to: "/maps", label: "Maps", Icon: Network },
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
  { to: "/inbox", label: "Inbox", Icon: Inbox },
  { to: "/signals", label: "Signals", Icon: RadioTower },
  { to: "/notes", label: "Brainstorm", Icon: Brain },
];

const secondaryNavItems: NavItem[] = [
  { to: "/settings", label: "Settings", Icon: Settings },
];

function ShellNavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const workspaceId = useWorkspaceId();
  const unreadSignalCount = useUnreadSignalCount();
  const isSignals = item.to === "/signals";

  return (
    <NavLink
      className={({ isActive }) =>
        clsx(
          "orbit-nav-link group relative flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium",
          isActive
            ? "orbit-nav-active bg-[#0a142c] text-white"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
          collapsed && "justify-center px-2",
        )
      }
      // The workspace root is a prefix of every other route, so without this
      // Today would read as active everywhere.
      end={item.to === "/"}
      onFocus={() => {
        void routePrefetchers[item.to]?.();
      }}
      onMouseEnter={() => {
        void routePrefetchers[item.to]?.();
      }}
      title={item.label}
      to={workspacePath(workspaceId, item.to)}
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            <item.Icon
              aria-hidden="true"
              className={clsx(
                "h-[1.125rem] w-[1.125rem] shrink-0 transition-colors",
                isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300",
              )}
            />
            {isSignals && collapsed && unreadSignalCount > 0 ? (
              <>
                {" "}
                <span
                  aria-label="Unread signals"
                  className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-violet-300"
                />
              </>
            ) : null}
          </div>
          {collapsed ? null : <span className="truncate">{item.label}</span>}
          {isSignals && !collapsed ? (
            <>
              {" "}
              <SignalCountBadge count={unreadSignalCount} />
            </>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  // Offers the workspace's agent tools to WebMCP-capable browsers; a no-op
  // everywhere else. Mounted here because the shell wraps every authenticated
  // screen and sits inside the workspace provider the tools need.
  useAgentTools();
  const [isCollapsed, setIsCollapsed] = useState(loadNavCollapsed);
  // The shell owns this so the bar can open the sheet and the sheet can close itself.
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  function toggleCollapsed() {
    setIsCollapsed((current) => {
      const next = !current;
      saveNavCollapsed(next);
      return next;
    });
  }

  return (
    <div
      data-testid="app-shell"
      className={`relative min-h-screen overflow-x-clip bg-[#020817] text-slate-100 lg:grid ${
        isCollapsed ? "lg:grid-cols-[4.25rem_minmax(0,1fr)]" : "lg:grid-cols-[14.5rem_minmax(0,1fr)]"
      }`}
    >
      <StarFieldBackground />
      <aside className="relative z-10 hidden min-w-0 flex-col overflow-y-auto border-b border-white/[0.08] bg-[#040b1d] px-4 py-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:border-b-0 lg:border-r lg:py-5">
        <div className={`flex items-center gap-2 ${isCollapsed ? "lg:justify-center" : "justify-between"}`}>
          {isCollapsed ? (
            <OrbitFloLogo className="hidden w-8 lg:block" variant="mark" />
          ) : (
            <OrbitFloLogo className="max-w-[10.75rem]" />
          )}
          <button
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="hidden h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200 lg:grid"
            onClick={toggleCollapsed}
            type="button"
          >
            {isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-3">
          <WorkspaceSwitcher isCollapsed={isCollapsed} />
        </div>
        <nav
          aria-label="Primary navigation"
          className={`mt-4 grid gap-1 lg:mt-7 lg:grid-cols-1 ${isCollapsed ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-6"}`}
        >
          {primaryNavItems.map((item) => (
            <ShellNavLink collapsed={isCollapsed} item={item} key={item.to} />
          ))}
        </nav>
        <nav
          aria-label="Utility navigation"
          className={`mt-2 grid gap-1 border-t border-white/[0.07] pt-2 lg:mt-auto lg:grid-cols-1 ${isCollapsed ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {secondaryNavItems.map((item) => (
            <ShellNavLink collapsed={isCollapsed} item={item} key={item.to} />
          ))}
        </nav>
        {isCollapsed ? null : (
          <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-xl border border-white/[0.08] bg-[#050d20]/80 p-2.5 shadow-[inset_0_1px_rgba(255,255,255,0.025)]">
            <GlobalQuickAdd />
            <CommandPalette />
          </div>
        )}
      </aside>
      <main className="relative z-10 min-w-0 p-4 pb-28 sm:p-6 sm:pb-28 lg:px-10 lg:py-8 lg:pb-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      <MobileTabBar onOpenMore={() => setIsMoreOpen(true)} />
      <MobileCaptureButton />
      {isMoreOpen ? <MobileMoreSheet onClose={() => setIsMoreOpen(false)} /> : null}
    </div>
  );
}
