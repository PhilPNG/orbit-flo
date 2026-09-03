import { clsx } from "clsx";
import { ChevronDown, GitBranch, LayoutGrid, Maximize2, PanelRight, Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { arrangeModeLabel, arrangeModes, type ArrangeMode } from "./map-layouts";
import type { MapSaveStatus } from "./use-map-editor";

export type MapToolbarProps = {
  status: MapSaveStatus;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  isInspectorOpen: boolean;
  onAddNode: () => void;
  onArrange: (mode: ArrangeMode) => void;
  onFitView: () => void;
  onToggleInspector: () => void;
  onRetrySave: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

const statusCopy: Record<MapSaveStatus, string> = {
  saved: "Saved",
  dirty: "Saving…",
  saving: "Saving…",
  error: "Couldn't save",
};

const buttonClass = "orbit-button-tertiary gap-1.5 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40";
const iconButtonClass = "orbit-button-tertiary h-8 w-8 justify-center px-0 disabled:cursor-not-allowed disabled:opacity-40";

export function MapSaveStatusIndicator({ status, error, onRetry }: { status: MapSaveStatus; error: string | null; onRetry: () => void }) {
  return (
    <div aria-live="polite" className="flex items-center gap-1.5 px-1 text-xs text-slate-400" data-status={status}>
      <span aria-hidden="true" className={clsx("map-save-dot", `map-save-dot-${status}`)} />
      <span title={status === "error" && error ? error : undefined}>{statusCopy[status]}</span>
      {status === "error" ? (
        <button className="font-semibold text-amber-200 transition hover:text-amber-100" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function ArrangeMenu({ onArrange }: { onArrange: (mode: ArrangeMode) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="relative" onKeyDown={(event) => event.key === "Escape" && setIsOpen(false)} ref={menuRef}>
      <button aria-expanded={isOpen} aria-haspopup="menu" className={buttonClass} onClick={() => setIsOpen((current) => !current)} type="button">
        <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
        Arrange
        <ChevronDown aria-hidden="true" className="h-3 w-3" />
      </button>
      {isOpen ? (
        <div className="surface-raised absolute right-0 top-9 z-20 grid w-40 gap-0.5 rounded-lg border border-slate-400/15 p-1" role="menu">
          {arrangeModes.map((mode) => (
            <button
              className="map-card-menu-item"
              key={mode}
              onClick={() => {
                setIsOpen(false);
                onArrange(mode);
              }}
              role="menuitem"
              type="button"
            >
              {arrangeModeLabel(mode)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MapToolbar({
  status,
  error,
  canUndo,
  canRedo,
  isInspectorOpen,
  onAddNode,
  onArrange,
  onFitView,
  onToggleInspector,
  onRetrySave,
  onUndo,
  onRedo,
}: MapToolbarProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
      <MapSaveStatusIndicator error={error} onRetry={onRetrySave} status={status} />
      <button aria-label="Undo" className={iconButtonClass} disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl+Z)" type="button">
        <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button aria-label="Redo" className={iconButtonClass} disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl+Shift+Z)" type="button">
        <Redo2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button className={buttonClass} onClick={onAddNode} type="button">
        <GitBranch aria-hidden="true" className="h-3.5 w-3.5" />
        Add node
      </button>
      <ArrangeMenu onArrange={onArrange} />
      <button aria-label="Fit view" className={iconButtonClass} onClick={onFitView} title="Fit view" type="button">
        <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button aria-pressed={isInspectorOpen} className={buttonClass} onClick={onToggleInspector} type="button">
        <PanelRight aria-hidden="true" className="h-3.5 w-3.5" />
        Details
      </button>
    </div>
  );
}
