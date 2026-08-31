import { Brain, Inbox, MoreHorizontal, Orbit, Rocket } from "lucide-react";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { routePrefetchers } from "../app/route-loaders";
import { useUnreadSignalCount } from "../features/signals/signal-badge";
import { useWorkspaceId } from "../features/workspaces/workspace-context";
import { workspacePath } from "../features/workspaces/workspace-path";

const tabs: Array<{ to: string; label: string; Icon: LucideIcon }> = [
  { to: "/", label: "Today", Icon: Orbit },
  { to: "/projects", label: "Missions", Icon: Rocket },
  { to: "/inbox", label: "Inbox", Icon: Inbox },
  { to: "/notes", label: "Brainstorm", Icon: Brain },
];

const targetClass =
  "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition";

// styles.css sets an unlayered `button { font: inherit }`, and unlayered rules
// beat Tailwind's layered utilities — so a text size on the button itself is
// silently dropped. Sizing the label directly works for both element types.
const labelClass = "text-[0.65rem] font-semibold leading-tight";

export function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const workspaceId = useWorkspaceId();
  // Signals lives inside the More sheet, not the visible tabs, so its unread
  // state has to surface here or it's two taps deep with no indicator.
  const unreadSignalCount = useUnreadSignalCount();

  return (
    <nav
      aria-label="Primary navigation"
      // The inset keeps the bar clear of the iPhone home indicator.
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-white/[0.08] bg-[#040b1d]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md lg:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          className={({ isActive }) => clsx(targetClass, isActive ? "text-cyan-200" : "text-slate-400")}
          // The workspace root is a prefix of every other route, so without
          // this Today would read as active everywhere.
          end={tab.to === "/"}
          key={tab.to}
          onFocus={() => void routePrefetchers[tab.to]?.()}
          to={workspacePath(workspaceId, tab.to)}
        >
          {({ isActive }) => (
            <>
              <tab.Icon
                aria-hidden="true"
                className={clsx("h-5 w-5", isActive ? "text-cyan-300" : "text-slate-500")}
              />
              <span className={labelClass}>{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button className={clsx(targetClass, "relative text-slate-400")} onClick={onOpenMore} type="button">
        <MoreHorizontal aria-hidden="true" className="h-5 w-5 text-slate-500" />
        <span className={labelClass}>More</span>
        {unreadSignalCount > 0 ? (
          <span
            aria-label="Unread signals"
            // Violet, not cyan: unread is a state, not an interactive affordance.
            className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-violet-300"
          />
        ) : null}
      </button>
    </nav>
  );
}
