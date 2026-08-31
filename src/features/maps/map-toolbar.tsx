import { GitBranch, PanelRight, Save } from "lucide-react";
import type { MindMapView } from "../../lib/supabase/database.types";
import { mapViewLabel, mapViews } from "./map-types";

type MapToolbarProps = {
  activeView: MindMapView;
  hasSelection: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onAddNode: () => void;
  onOpenDetails: () => void;
  onSave: () => void;
  onViewChange: (view: MindMapView) => void;
};

export function MapToolbar({
  activeView,
  hasSelection,
  isDirty,
  isSaving,
  onAddNode,
  onOpenDetails,
  onSave,
  onViewChange,
}: MapToolbarProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/45 px-2 py-1">
      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Map views">
        {mapViews.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={activeView === view}
            className={`border-b-2 px-2.5 py-2 text-xs font-medium transition ${
              activeView === view
                ? "border-cyan-300 text-cyan-100"
                : "border-transparent text-slate-400 hover:border-slate-500/70 hover:text-slate-100"
            }`}
            onClick={() => onViewChange(view)}
          >
            {mapViewLabel(view)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">{isDirty ? "Unsaved changes" : "Saved"}</span>
        <button
          type="button"
          className="orbit-button-tertiary gap-1.5 px-2.5 py-1.5 text-xs"
          onClick={onAddNode}
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
          Add node
        </button>
        <button
          type="button"
          className="orbit-button-tertiary gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasSelection}
          onClick={onOpenDetails}
        >
          <PanelRight className="h-3.5 w-3.5" aria-hidden="true" />
          Details
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!isDirty || isSaving}
          onClick={onSave}
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {isSaving ? "Saving..." : "Save map"}
        </button>
      </div>
    </div>
  );
}
