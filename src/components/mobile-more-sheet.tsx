import { CalendarDays, LayoutDashboard, Network, RadioTower, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { CommandPalette } from "./command-palette";
import { SignalCountBadge, useUnreadSignalCount } from "../features/signals/signal-badge";
import { useWorkspaceId } from "../features/workspaces/workspace-context";
import { workspacePath } from "../features/workspaces/workspace-path";
import { Modal } from "./modal";

const moreItems: Array<{ to: string; label: string; Icon: LucideIcon }> = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/maps", label: "Maps", Icon: Network },
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
  { to: "/signals", label: "Signals", Icon: RadioTower },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function MobileMoreSheet({ onClose }: { onClose: () => void }) {
  const workspaceId = useWorkspaceId();
  const unreadSignalCount = useUnreadSignalCount();

  return (
    <Modal onClose={onClose} size="sm" title="More">
      <div className="grid gap-2">
        {moreItems.map((item) => (
          <NavLink
            className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-400/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30"
            key={item.to}
            onClick={onClose}
            to={workspacePath(workspaceId, item.to)}
          >
            <item.Icon aria-hidden="true" className="h-4 w-4 text-slate-400" />
            {item.label}
            {item.to === "/signals" ? <SignalCountBadge count={unreadSignalCount} /> : null}
          </NavLink>
        ))}

        {/* The sidebar's palette instance owns its own state and is hidden on
            phones, so the sheet carries its own. */}
        <div className="border-t border-slate-400/12 pt-2">
          <CommandPalette />
        </div>
      </div>
    </Modal>
  );
}
