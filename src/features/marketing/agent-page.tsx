/**
 * The full agent story at /agent - the ten WebMCP tools Orbit Flo registers
 * for a signed-in session, as a table.
 *
 * The descriptions here are paraphrased by hand from
 * `src/features/agent/agent-tools.ts` rather than imported from it (that
 * module needs a live Supabase client and query client to build its tool
 * list, which this signed-out page has neither of). The tradeoff: this page
 * can drift from the real tool set if agent-tools.ts changes and this file
 * doesn't. The test file pins the ten names, sorted, as a tripwire for that
 * drift - it does not eliminate it.
 */
import { useEffect } from "react";
import { MarketingLayout } from "./marketing-layout";

type ToolRow = {
  name: string;
  description: string;
  readOnly: boolean;
};

// Sorted alphabetically - matches the pinned assertion in agent-page.test.tsx.
const TOOLS: ToolRow[] = [
  {
    name: "add_to_flight_plan",
    description: "Add a task to today's flight plan.",
    readOnly: false,
  },
  {
    name: "capture_thought",
    description: "Capture a quick thought into the inbox for later triage.",
    readOnly: false,
  },
  {
    name: "complete_plan_item",
    description: "Mark a flight-plan item as completed; the user sees the completion animation.",
    readOnly: false,
  },
  {
    name: "create_task",
    description: "Create a task in a project; it appears on the kanban board immediately.",
    readOnly: false,
  },
  {
    name: "file_capture_as_task",
    description: "Turn an unprocessed inbox capture into a task in a project.",
    readOnly: false,
  },
  {
    name: "get_flight_plan",
    description: "Get today's flight plan and the work items due, with their ids.",
    readOnly: true,
  },
  {
    name: "list_inbox",
    description: "List unprocessed inbox captures, with their ids, titles and types.",
    readOnly: true,
  },
  {
    name: "list_projects",
    description: "List the workspace's projects with their ids, names and statuses.",
    readOnly: true,
  },
  {
    name: "move_task",
    description: "Move a task to another status column; the board updates immediately.",
    readOnly: false,
  },
  {
    name: "search_workspace",
    description: "Search tasks, notes, projects and milestones across the workspace.",
    readOnly: true,
  },
];

export function AgentPage() {
  useEffect(() => {
    document.title = "Agent — Orbit Flo";
  }, []);

  return (
    <MarketingLayout>
      <div className="orbit-page-enter py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300/80">WebMCP inside</p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl">
            Your agent works here too.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-slate-300">
            Orbit Flo registers ten tools with the browser&apos;s WebMCP surface
            (<code className="font-mono text-cyan-200">document.modelContext</code>). An
            agent-hosting browser calling any of them gets your own signed-in session -
            row-level security and column grants decide what it can touch, not the tool
            layer. Those grants are verified in CI on every pull request, and the
            row-level policies behind them are exercised by a two-account behavioural
            harness.
          </p>
        </div>

        <div className="orbit-panel mt-12 overflow-x-auto rounded-2xl p-2">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-400/10 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-semibold">Tool</th>
                <th className="px-4 py-3 font-semibold">What it does</th>
                <th className="px-4 py-3 font-semibold">Kind</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool) => (
                <tr className="border-b border-slate-400/5 last:border-0" key={tool.name}>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-100">{tool.name}</td>
                  <td className="px-4 py-3 text-slate-300">{tool.description}</td>
                  <td className="px-4 py-3 text-slate-400">{tool.readOnly ? "Read-only" : "Mutating"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default AgentPage;
