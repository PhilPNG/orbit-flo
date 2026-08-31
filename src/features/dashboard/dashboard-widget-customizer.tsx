import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";

export type DashboardWidgetConfig = {
  key: string;
  label: string;
  isVisible: boolean;
  sortOrder: number;
};

export const defaultDashboardWidgets: DashboardWidgetConfig[] = [
  { key: "project-health", label: "Project health", isVisible: true, sortOrder: 0 },
  { key: "priority-work", label: "Priority work", isVisible: true, sortOrder: 1 },
  { key: "blocked-work", label: "Blocked work", isVisible: true, sortOrder: 2 },
  { key: "upcoming-milestones", label: "Upcoming milestones", isVisible: true, sortOrder: 3 },
  { key: "recent-decisions", label: "Recent decisions", isVisible: true, sortOrder: 4 },
];

function sortWidgets(widgets: DashboardWidgetConfig[]) {
  return [...widgets].sort((a, b) => a.sortOrder - b.sortOrder);
}

function normalizeSortOrder(widgets: DashboardWidgetConfig[]) {
  return widgets.map((widget, index) => ({ ...widget, sortOrder: index }));
}

export function mergeDashboardWidgets(
  defaults: DashboardWidgetConfig[],
  preferences: Array<{ widget_key: string; is_visible: boolean; sort_order: number }> = [],
) {
  const preferencesByKey = new Map(preferences.map((preference) => [preference.widget_key, preference]));

  return normalizeSortOrder(
    sortWidgets(
      defaults.map((widget) => {
        const preference = preferencesByKey.get(widget.key);
        if (!preference) return widget;

        return {
          ...widget,
          isVisible: preference.is_visible,
          sortOrder: preference.sort_order,
        };
      }),
    ),
  );
}

type DashboardWidgetCustomizerProps = {
  isDisabled?: boolean;
  widgets: DashboardWidgetConfig[];
  onChange: (widgets: DashboardWidgetConfig[]) => void;
};

export function DashboardWidgetCustomizer({ isDisabled = false, widgets, onChange }: DashboardWidgetCustomizerProps) {
  const sortedWidgets = sortWidgets(widgets);

  function toggleWidget(widgetKey: string) {
    onChange(
      normalizeSortOrder(
        sortedWidgets.map((widget) =>
          widget.key === widgetKey ? { ...widget, isVisible: !widget.isVisible } : widget,
        ),
      ),
    );
  }

  function moveWidget(widgetKey: string, direction: -1 | 1) {
    const currentIndex = sortedWidgets.findIndex((widget) => widget.key === widgetKey);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedWidgets.length) return;

    const nextWidgets = [...sortedWidgets];
    [nextWidgets[currentIndex], nextWidgets[nextIndex]] = [nextWidgets[nextIndex], nextWidgets[currentIndex]];
    onChange(normalizeSortOrder(nextWidgets));
  }

  return (
    <section className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-cyan-100" />
        <h2 className="mission-label">Dashboard widgets</h2>
      </div>
      <div className="mt-4 grid gap-2">
        {sortedWidgets.map((widget, index) => (
          <div
            className="grid gap-3 rounded-lg border border-slate-400/15 bg-slate-950/35 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            key={widget.key}
          >
            <label className="flex min-w-0 items-center gap-3 text-sm font-semibold text-white">
              <input
                checked={widget.isVisible}
                className="h-4 w-4 rounded border-slate-400/40 bg-slate-950 text-cyan-300 accent-cyan-300"
                disabled={isDisabled}
                onChange={() => toggleWidget(widget.key)}
                type="checkbox"
              />
              <span className="break-words">Show {widget.label}</span>
            </label>
            <div className="flex gap-2 sm:justify-end">
              <button
                aria-label={`Move ${widget.label} up`}
                className="orbit-button-secondary grid h-9 w-9 place-items-center p-0"
                disabled={isDisabled || index === 0}
                onClick={() => moveWidget(widget.key, -1)}
                type="button"
              >
                <ArrowUp aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                aria-label={`Move ${widget.label} down`}
                className="orbit-button-secondary grid h-9 w-9 place-items-center p-0"
                disabled={isDisabled || index === sortedWidgets.length - 1}
                onClick={() => moveWidget(widget.key, 1)}
                type="button"
              >
                <ArrowDown aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
