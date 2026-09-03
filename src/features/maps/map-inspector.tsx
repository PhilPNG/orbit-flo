import { ArrowUpRight, Trash2, X } from "lucide-react";
import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/field";
import { InlineAlert } from "../../components/inline-alert";
import { workspacePath } from "../workspaces/workspace-path";
import { deleteEdge, deleteNode, nodeAccentColor, updateEdge, updateNode } from "./map-graph-ops";
import {
  mapEdgeTypeLabel,
  mapEdgeTypes,
  mapNodeStatusLabel,
  mapNodeStatuses,
  mapNodeTypeLabel,
  mapNodeTypes,
  type ConvertedObjectType,
  type EditableMapEdge,
  type EditableMapGraph,
  type EditableMapNode,
} from "./map-types";
import type { MapSelection, SetGraphOptions } from "./use-map-editor";

export type MapInspectorProps = {
  graph: EditableMapGraph;
  selection: MapSelection;
  workspaceId: string;
  projectId: string | null;
  isConverting: boolean;
  conversionError: string | null;
  onGraphChange: (graph: EditableMapGraph, options?: SetGraphOptions) => void;
  onSelect: (selection: MapSelection) => void;
  onConvert: (type: ConvertedObjectType) => void;
};

const inputClass = "orbit-input w-full px-3 py-2 text-sm";
const eyebrowClass = "text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500";
const conversionOptions: Array<{ type: ConvertedObjectType; label: string }> = [
  { type: "task", label: "Task" },
  { type: "note", label: "Note" },
  { type: "milestone", label: "Milestone" },
];

export function convertedHref(workspaceId: string, projectId: string | null, node: EditableMapNode): string | null {
  if (!node.convertedType || !node.convertedId) return null;
  if (node.convertedType === "task") {
    return projectId ? workspacePath(workspaceId, `/projects/${projectId}?task=${node.convertedId}`) : null;
  }
  if (node.convertedType === "note") return workspacePath(workspaceId, `/notes?note=${node.convertedId}`);
  return workspacePath(workspaceId, `/milestones/${node.convertedId}`);
}

function Eyebrow({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p className={eyebrowClass}>{label}</p>
      <h2 className="mt-1 truncate text-base font-semibold text-white">{title}</h2>
    </div>
  );
}

type NodeInspectorProps = Omit<MapInspectorProps, "selection"> & { node: EditableMapNode };

function NodeInspector({
  graph,
  node,
  workspaceId,
  projectId,
  isConverting,
  conversionError,
  onGraphChange,
  onSelect,
  onConvert,
}: NodeInspectorProps) {
  const [tagDraft, setTagDraft] = useState("");
  const isConverted = Boolean(node.convertedId);
  const href = convertedHref(workspaceId, projectId, node);
  const needsProject = !projectId;

  function patch(fields: Partial<Omit<EditableMapNode, "id">>, coalesceKey?: string) {
    onGraphChange(updateNode(graph, node.id, fields), coalesceKey ? { coalesceKey: `node:${node.id}:${coalesceKey}` } : undefined);
  }

  function commitTag(raw: string) {
    const tag = raw.trim();
    setTagDraft("");
    if (!tag || node.tags.includes(tag)) return;
    patch({ tags: [...node.tags, tag] });
  }

  return (
    <div className="grid gap-4">
      <Eyebrow label="Node" title={node.title} />

      <Field label="Title">
        <input className={inputClass} onChange={(event) => patch({ title: event.target.value }, "title")} value={node.title} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select
            className={inputClass}
            onChange={(event) => {
              const nodeType = event.target.value as EditableMapNode["nodeType"];
              patch({ nodeType, accent: nodeAccentColor(nodeType) });
            }}
            value={node.nodeType}
          >
            {mapNodeTypes.map((type) => (
              <option key={type} value={type}>
                {mapNodeTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          {isConverted ? (
            <p className="orbit-input px-3 py-2 text-sm text-slate-300">Converted</p>
          ) : (
            <select
              className={inputClass}
              onChange={(event) => patch({ status: event.target.value as EditableMapNode["status"] })}
              value={node.status}
            >
              {mapNodeStatuses
                .filter((status) => status !== "converted")
                .map((status) => (
                  <option key={status} value={status}>
                    {mapNodeStatusLabel(status)}
                  </option>
                ))}
            </select>
          )}
        </Field>
      </div>

      <Field label="Notes">
        <textarea className={`${inputClass} min-h-28`} onChange={(event) => patch({ body: event.target.value }, "body")} value={node.body} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input className={inputClass} onChange={(event) => patch({ startDate: event.target.value || null })} type="date" value={node.startDate ?? ""} />
        </Field>
        <Field label="Due date">
          <input className={inputClass} onChange={(event) => patch({ dueDate: event.target.value || null })} type="date" value={node.dueDate ?? ""} />
        </Field>
      </div>

      <div className="grid gap-1 text-sm">
        <span className="font-medium text-slate-200">Tags</span>
        {node.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => (
              <li className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-200" key={tag}>
                {tag}
                <button
                  aria-label={`Remove tag ${tag}`}
                  className="text-slate-400 hover:text-white"
                  onClick={() => patch({ tags: node.tags.filter((item) => item !== tag) })}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          aria-label="Add tag"
          className={inputClass}
          onChange={(event) => {
            const value = event.target.value;
            if (value.endsWith(",")) commitTag(value.slice(0, -1));
            else setTagDraft(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTag(tagDraft);
            }
          }}
          placeholder="Add a tag and press Enter"
          value={tagDraft}
        />
      </div>

      <section className="grid gap-2 border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-slate-200">Convert to</p>
        {isConverted ? (
          <p className="text-sm text-slate-300">
            Converted to {node.convertedType ?? "workspace item"}.{" "}
            {href ? (
              <Link className="inline-flex items-center gap-1 font-semibold text-cyan-200 hover:text-cyan-100" to={href}>
                Open
                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {conversionOptions.map((option) => (
                <button
                  className="orbit-button-secondary justify-center px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isConverting || (needsProject && option.type !== "note")}
                  key={option.type}
                  onClick={() => onConvert(option.type)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {needsProject ? <p className="text-xs text-amber-200">Choose a project map to convert to a task or milestone.</p> : null}
          </>
        )}
        {conversionError ? <InlineAlert tone="error">{conversionError}</InlineAlert> : null}
      </section>

      <button
        className="orbit-button-danger-quiet justify-center gap-1.5 text-xs"
        onClick={() => {
          onGraphChange(deleteNode(graph, node.id));
          onSelect(null);
        }}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Delete node
      </button>
    </div>
  );
}

type EdgeInspectorProps = Pick<MapInspectorProps, "graph" | "onGraphChange" | "onSelect"> & { edge: EditableMapEdge };

function EdgeInspector({ graph, edge, onGraphChange, onSelect }: EdgeInspectorProps) {
  const titleOf = (id: string) => graph.nodes.find((node) => node.id === id)?.title ?? "?";

  function patch(fields: Partial<Omit<EditableMapEdge, "id">>, coalesceKey?: string) {
    onGraphChange(updateEdge(graph, edge.id, fields), coalesceKey ? { coalesceKey: `edge:${edge.id}:${coalesceKey}` } : undefined);
  }

  return (
    <div className="grid gap-4">
      <Eyebrow label="Connection" title={`${titleOf(edge.sourceNodeId)} → ${titleOf(edge.targetNodeId)}`} />

      <Field label="Type">
        <select className={inputClass} onChange={(event) => patch({ edgeType: event.target.value as EditableMapEdge["edgeType"] })} value={edge.edgeType}>
          {mapEdgeTypes.map((type) => (
            <option key={type} value={type}>
              {mapEdgeTypeLabel(type)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label">
        <input className={inputClass} onChange={(event) => patch({ label: event.target.value }, "label")} value={edge.label} />
      </Field>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-200">Directional</span>
        <input
          aria-label="Directional"
          checked={edge.isDirectional}
          className="h-4 w-4 accent-cyan-300"
          onChange={(event) => patch({ isDirectional: event.target.checked })}
          role="switch"
          type="checkbox"
        />
      </label>

      <button
        className="orbit-button-danger-quiet justify-center gap-1.5 text-xs"
        onClick={() => {
          onGraphChange(deleteEdge(graph, edge.id));
          onSelect(null);
        }}
        type="button"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Delete connection
      </button>
    </div>
  );
}

function MapDetails({ graph, onGraphChange }: Pick<MapInspectorProps, "graph" | "onGraphChange">) {
  return (
    <div className="grid gap-4">
      <Eyebrow label="Map" title={graph.title} />
      <Field label="Title">
        <input className={inputClass} onChange={(event) => onGraphChange({ ...graph, title: event.target.value }, { coalesceKey: "map:title" })} value={graph.title} />
      </Field>
      <Field label="Description">
        <textarea
          className={`${inputClass} min-h-24`}
          onChange={(event) => onGraphChange({ ...graph, description: event.target.value }, { coalesceKey: "map:description" })}
          value={graph.description}
        />
      </Field>
      <p className="text-sm text-slate-400">Select a node or connection to edit it.</p>
    </div>
  );
}

export const MapInspector = memo(function MapInspector(props: MapInspectorProps) {
  const { graph, selection } = props;
  const node = selection?.kind === "node" ? (graph.nodes.find((item) => item.id === selection.id) ?? null) : null;
  const edge = selection?.kind === "edge" ? (graph.edges.find((item) => item.id === selection.id) ?? null) : null;

  // Keying by node id resets local drafts (tags) instead of carrying them between nodes.
  if (node) return <NodeInspector {...props} key={node.id} node={node} />;
  if (edge) return <EdgeInspector edge={edge} graph={graph} onGraphChange={props.onGraphChange} onSelect={props.onSelect} />;
  return <MapDetails graph={graph} onGraphChange={props.onGraphChange} />;
});
