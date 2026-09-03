import { MoreHorizontal } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import type { MindMap, MindMapPreview } from "./maps.queries";
import { TemplateThumbnail } from "./map-template-thumbnail";

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type MapCardProps = {
  map: MindMap;
  preview?: MindMapPreview;
  isRenaming: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
};

export const MapCard = memo(function MapCard({
  map,
  preview,
  isRenaming,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onDuplicate,
  onArchive,
}: MapCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draft, setDraft] = useState(map.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      setDraft(map.title);
      settledRef.current = false;
    }
    // Only reset the guard when a new rename session starts, not on every
    // map.title change — otherwise a title update mid-session would reopen
    // the guard and let a stray unmount-driven blur double-commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenaming]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  function commitRename() {
    if (settledRef.current) return;
    settledRef.current = true;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === map.title) onCancelRename();
    else onRename(trimmed);
  }

  function cancelRename() {
    if (settledRef.current) return;
    settledRef.current = true;
    onCancelRename();
  }

  const nodeCount = preview?.nodes.length;
  const countLabel = nodeCount === undefined ? "…" : `${nodeCount} ${nodeCount === 1 ? "node" : "nodes"}`;

  return (
    <article className="map-card surface-primary relative grid gap-3 rounded-xl p-3" data-testid={`map-card-${map.id}`}>
      <button aria-label={`Open ${map.title}`} className="map-card-open rounded-md" onClick={onOpen} type="button">
        {preview ? (
          <TemplateThumbnail edges={preview.edges} nodes={preview.nodes} size="md" />
        ) : (
          <span aria-hidden="true" className="map-card-thumbnail-placeholder block aspect-[16/9] w-full rounded-md" />
        )}
      </button>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <input
              aria-label="Map title"
              autoFocus
              className="orbit-input w-full px-2 py-1 text-sm"
              onBlur={commitRename}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              value={draft}
            />
          ) : (
            <button
              className="block max-w-full truncate text-left text-sm font-semibold text-white transition hover:text-cyan-100"
              onClick={onOpen}
              type="button"
            >
              {map.title}
            </button>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            {countLabel} · Updated {formatRelativeTime(map.updated_at)}
          </p>
        </div>

        <div className="relative shrink-0" onKeyDown={(event) => event.key === "Escape" && setIsMenuOpen(false)} ref={menuRef}>
          <button
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label={`Map actions for ${map.title}`}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>
          {isMenuOpen ? (
            <div className="surface-raised absolute right-0 top-8 z-20 grid w-36 gap-0.5 rounded-lg border border-slate-400/15 p-1" role="menu">
              {[
                { label: "Rename", action: onStartRename },
                { label: "Duplicate", action: onDuplicate },
                { label: "Archive", action: onArchive },
              ].map(({ label, action }) => (
                <button
                  className="map-card-menu-item"
                  key={label}
                  onClick={() => {
                    setIsMenuOpen(false);
                    action();
                  }}
                  role="menuitem"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
});
