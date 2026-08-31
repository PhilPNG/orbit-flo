import { clsx } from "clsx";
import { useState, type ReactNode } from "react";

const missionLogTabs = ["Focus", "Review", "Timeline", "Shutdown", "Reflection"] as const;

export type MissionLogTab = (typeof missionLogTabs)[number];

export function MissionLog({
  defaultOpen = false,
  panels,
}: {
  defaultOpen?: boolean;
  panels: Record<MissionLogTab, ReactNode>;
}) {
  const [activeTab, setActiveTab] = useState<MissionLogTab>("Focus");

  return (
    <details className="surface-whisper today-mission-log rounded-xl px-4 py-3" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-300 transition hover:text-white">
        Mission log
      </summary>
      <div className="mt-4">
        <div className="flex flex-wrap gap-1 border-b border-slate-400/10" role="tablist">
          {missionLogTabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={clsx(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
                activeTab === tab
                  ? "border-cyan-300 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200",
              )}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-5">{panels[activeTab]}</div>
      </div>
    </details>
  );
}
