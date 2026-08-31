import { Field } from "../../components/field";
import { memo } from "react";
import type { ConvertedObjectType, EditableMapNode } from "./map-types";

type MapInspectorProps = {
  node: EditableMapNode | null;
  conversionDisabledReason?: string | null;
  conversionDisabledReasons?: Partial<Record<ConvertedObjectType, string | null>>;
  isConverting?: boolean;
  onConvert: (type: ConvertedObjectType) => void;
  onNodeChange: (node: EditableMapNode) => void;
};

const conversionOptions: Array<{ type: ConvertedObjectType; label: string }> = [
  { type: "task", label: "Convert to task" },
  { type: "note", label: "Convert to note" },
  { type: "milestone", label: "Convert to milestone" },
];

export const MapInspector = memo(function MapInspector({
  node,
  conversionDisabledReason = null,
  conversionDisabledReasons = {},
  isConverting = false,
  onConvert,
  onNodeChange,
}: MapInspectorProps) {
  if (!node) {
    return (
      <aside className="rounded-lg p-4">
        <h2 className="text-lg font-semibold text-slate-100">Inspector</h2>
        <p className="mt-2 text-sm text-slate-400">Select a node to edit its details or convert it into workspace content.</p>
      </aside>
    );
  }

  const isConverted = Boolean(node.convertedId);
  const visibleDisabledReasons = Array.from(
    new Set([conversionDisabledReason, ...Object.values(conversionDisabledReasons)].filter(Boolean)),
  );

  return (
    <aside className="grid gap-4 rounded-lg p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Inspector</h2>
        <p className="mt-1 text-sm text-slate-300">{node.title}</p>
      </div>

      <Field label="Node title">
        <input
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
          value={node.title}
          onChange={(event) => onNodeChange({ ...node, title: event.target.value })}
        />
      </Field>

      <Field label="Node notes">
        <textarea
          className="min-h-28 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
          value={node.body}
          onChange={(event) => onNodeChange({ ...node, body: event.target.value })}
        />
      </Field>

      <Field label="Due date">
        <input
          className="rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
          type="date"
          value={node.dueDate ?? ""}
          onChange={(event) => onNodeChange({ ...node, dueDate: event.target.value || null })}
        />
      </Field>

      <div className="grid gap-2">
        {conversionOptions.map((option) => {
          const reason = conversionDisabledReason ?? conversionDisabledReasons[option.type];
          const isConversionDisabled = isConverted || isConverting || Boolean(reason);

          return (
            <button
              key={option.type}
              type="button"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-medium text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isConversionDisabled}
              onClick={() => onConvert(option.type)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {isConverted ? <p className="text-sm text-slate-400">Converted to {node.convertedType ?? "workspace item"}.</p> : null}
      {!isConverted
        ? visibleDisabledReasons.map((reason) => (
            <p className="text-sm text-amber-200" key={reason}>
              {reason}
            </p>
          ))
        : null}
    </aside>
  );
});
