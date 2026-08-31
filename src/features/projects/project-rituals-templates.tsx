import { Layers3, X } from "lucide-react";
import type { ProjectPriority, WorkItemStatus } from "../../lib/supabase/database.types";
import { templateSlug } from "./template-usage.queries";

export type TemplateWorkItem = {
  title: string;
  description: string;
  priority: ProjectPriority;
  status: WorkItemStatus;
};

const templates: Array<{
  name: string;
  description: string;
  items: TemplateWorkItem[];
}> = [
  {
    name: "Bug fix day",
    description: "A compact flow for reproducing, fixing, verifying, and documenting a defect.",
    items: [
      {
        title: "Reproduce the bug",
        description: "Capture exact steps, expected behavior, and actual behavior before changing code.",
        priority: "high",
        status: "ready",
      },
      {
        title: "Write or update regression coverage",
        description: "Add the smallest test that proves the defect is fixed.",
        priority: "medium",
        status: "backlog",
      },
      {
        title: "Ship and verify the fix",
        description: "Deploy the fix, check the affected path, and record the verification result.",
        priority: "high",
        status: "backlog",
      },
    ],
  },
  {
    name: "Feature slice",
    description: "Turn a fuzzy idea into a thin usable release.",
    items: [
      {
        title: "Define the smallest useful version",
        description: "Write the user outcome and what is intentionally out of scope.",
        priority: "medium",
        status: "ready",
      },
      {
        title: "Build the first usable slice",
        description: "Implement the core interaction with real data and empty states.",
        priority: "high",
        status: "backlog",
      },
      {
        title: "Polish the release path",
        description: "Handle loading, error, mobile, and accessibility states before shipping.",
        priority: "medium",
        status: "backlog",
      },
    ],
  },
];

export function TemplatesPanel({
  isApplying = false,
  onApplyTemplate,
  onHide,
  useCounts,
}: {
  isApplying?: boolean;
  onApplyTemplate: (items: TemplateWorkItem[], name: string) => void;
  onHide: () => void;
  useCounts?: Map<string, number>;
}) {
  return (
    <div className="orbit-panel-soft rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
            <Layers3 aria-hidden="true" className="h-4 w-4" />
          </span>
          <div>
            <p className="mission-label">Reusable planning</p>
            <h2 className="text-base font-black text-white">Templates</h2>
          </div>
        </div>
        <button
          aria-label="Hide templates"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          onClick={onHide}
          type="button"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {templates.map((template) => (
          <article className="rounded-lg border border-slate-400/15 bg-slate-950/35 p-3" key={template.name}>
            <h3 className="text-sm font-black text-white">{template.name}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">{template.description}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                aria-label={`Apply ${template.name} template`}
                className="orbit-button-secondary px-3 py-1.5 text-xs"
                disabled={isApplying}
                onClick={() => onApplyTemplate(template.items, template.name)}
                type="button"
              >
                Apply template
              </button>
              <span className="shrink-0 text-xs font-semibold text-slate-500">
                {useCounts?.get(templateSlug(template.name)) ?? 0} uses
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
