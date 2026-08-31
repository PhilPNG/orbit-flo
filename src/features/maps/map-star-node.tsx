import { Handle, Position } from "@xyflow/react";
import { clsx } from "clsx";
import { memo, useEffect, useRef, useState } from "react";
import type { NodeShape } from "./map-graph-ops";

export type StarNodeData = {
  label: string;
  accent: "cyan" | "blue" | "violet";
  shape: NodeShape;
  isConverted: boolean;
  isRenaming: boolean;
  onRenameCommit: (title: string) => void;
  onRenameCancel: () => void;
};

export const StarNode = memo(function StarNode({
  data,
  selected = false,
}: {
  data: StarNodeData;
  selected?: boolean;
}) {
  const [draft, setDraft] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.isRenaming) {
      setDraft(data.label);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [data.isRenaming, data.label]);

  return (
    <div
      className={clsx("star-node flex items-center gap-3 py-1", selected && "star-node-selected")}
      data-testid="star-node-root"
    >
      <Handle position={Position.Left} type="target" />
      <span
        aria-hidden="true"
        className={clsx(
          "star-glyph",
          data.shape === "dot" && ["star-dot", `star-dot-${data.accent}`],
          data.shape !== "dot" && [`star-glyph-${data.shape}`, `star-glyph-${data.accent}`],
        )}
        data-testid="star-glyph"
      />
      {data.isRenaming ? (
        <span className="orbit-star-node-label">
          <input
            aria-label="Node title"
            className="orbit-star-node-input w-36 bg-transparent text-sm font-semibold text-white outline-none"
            onBlur={() => data.onRenameCommit(draft.trim() || data.label)}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                data.onRenameCommit(draft.trim() || data.label);
              }
              if (event.key === "Escape") {
                event.stopPropagation();
                data.onRenameCancel();
              }
            }}
            ref={inputRef}
            value={draft}
          />
          {data.isConverted ? (
            <span aria-hidden="true" className="star-planet-badge" data-testid="star-converted-badge" />
          ) : null}
        </span>
      ) : (
        <span className="orbit-star-node-label max-w-52 text-sm font-semibold text-white">
          <span className="min-w-0 truncate">{data.label}</span>
          {data.isConverted ? (
            <span aria-hidden="true" className="star-planet-badge shrink-0" data-testid="star-converted-badge" />
          ) : null}
        </span>
      )}
      <Handle position={Position.Right} type="source" />
    </div>
  );
});
