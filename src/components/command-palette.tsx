import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Command, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCapture } from "../features/daily/daily-plan.queries";
import { useAuth } from "../features/auth/use-auth";
import {
  searchKeys,
  searchWorkspace,
  type SearchResult,
  type SearchResultType,
} from "../features/search/search.queries";
import { parseQuickAdd } from "../lib/quick-add";
import { supabase } from "../lib/supabase/client";
import { hasSearchCriteria, parseSearchQuery } from "../features/search/search-query";
import { Modal } from "./modal";
import { useWorkspaceId } from "../features/workspaces/workspace-context";
import { workspacePath } from "../features/workspaces/workspace-path";

const resultGroups: Array<{ type: SearchResultType; heading: string }> = [
  { type: "task", heading: "Tasks" },
  { type: "note", heading: "Notes" },
  { type: "project", heading: "Missions" },
  { type: "milestone", heading: "Milestones" },
];

const resultsPerGroup = 5;

function rowClassName(isHighlighted: boolean) {
  return [
    "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition",
    isHighlighted
      ? "border-cyan-300/40 bg-cyan-300/10"
      : "border-slate-400/10 bg-white/[0.03] hover:border-cyan-300/30 hover:bg-cyan-300/10",
  ].join(" ");
}

const routeCommands = [
  {
    label: "Today",
    description: "Review daily plan, focus, and momentum.",
    to: "/",
  },
  {
    label: "Missions",
    description: "Open project missions and workspaces.",
    to: "/projects",
  },
  {
    label: "Maps",
    description: "Open visual planning maps.",
    to: "/maps",
  },
  {
    label: "Calendar",
    description: "Review scheduled work and due dates.",
    to: "/calendar",
  },
  {
    label: "Inbox",
    description: "Process captures and loose threads.",
    to: "/inbox",
  },
  {
    label: "Brainstorm",
    description: "Open notes and ideas.",
    to: "/notes",
  },
  {
    label: "Settings",
    description: "Manage workspace and account settings.",
    to: "/settings",
  },
];

export function CommandPalette() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const filteredRouteCommands = useMemo(() => {
    if (!normalizedQuery) return routeCommands;

    return routeCommands.filter((commandItem) =>
      `${commandItem.label} ${commandItem.description}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
      setHighlightIndex(0);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [trimmedQuery]);

  const searchQuery = useQuery({
    queryKey: searchKeys.workspace(workspaceId, debouncedQuery),
    queryFn: () => searchWorkspace(supabase, workspaceId, debouncedQuery),
    // An operator alone is a valid search: tag:design needs no text term.
    enabled: Boolean(user) && hasSearchCriteria(parseSearchQuery(debouncedQuery)),
    // Keeps the previous results on screen instead of flashing empty while typing.
    placeholderData: (previous) => previous,
  });

  const searchResults = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  const groupedResults = useMemo(
    () =>
      resultGroups
        .map((group) => ({
          ...group,
          items: searchResults.filter((entry) => entry.type === group.type).slice(0, resultsPerGroup),
        }))
        .filter((group) => group.items.length > 0),
    [searchResults],
  );

  const navigableItems = useMemo(
    () => [
      ...filteredRouteCommands.map((commandItem) => ({ key: commandItem.to, to: commandItem.to })),
      ...groupedResults.flatMap((group) =>
        group.items.map((item) => ({ key: `${item.type}:${item.id}`, to: item.to })),
      ),
    ],
    [filteredRouteCommands, groupedResults],
  );

  const captureMutation = useMutation({
    mutationFn: async (captureQuery: string) => {
      if (!user) throw new Error("Workspace and user are required for quick capture.");

      const parsed = parseQuickAdd(captureQuery);
      return createCapture(supabase, {
        workspaceId,
        userId: user.id,
        type: parsed.type,
        title: parsed.title,
        body: parsed.body,
      });
    },
    onSuccess: async () => {
      setQuery("");
      setSuccessMessage("Capture added to Inbox.");
      await queryClient.invalidateQueries({ queryKey: ["inbox-captures", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["daily-mission-control"] });
    },
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSuccessMessage("");
        setIsOpen(true);
      }

      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function closePalette() {
    setIsOpen(false);
  }

  function openPalette() {
    setSuccessMessage("");
    setIsOpen(true);
  }

  // Command entries and search hits both carry workspace-relative paths.
  function openRoute(to: string) {
    navigate(workspacePath(workspaceId, to));
    closePalette();
  }

  function captureQuery() {
    setSuccessMessage("");
    if (!trimmedQuery) return;
    captureMutation.mutate(trimmedQuery);
  }

  const captureError =
    captureMutation.isError && captureMutation.error instanceof Error
      ? captureMutation.error.message
      : "Unable to create capture.";

  return (
    <div>
      <button
        aria-label="Open command palette"
        className="orbit-button-secondary group flex w-full items-center justify-between gap-2 border-white/[0.1] bg-white/[0.03] px-2 py-2 text-left text-xs font-semibold"
        onClick={openPalette}
        type="button"
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <Command aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-cyan-200" />
          <span className="truncate">Commands</span>
        </span>
        {/* The shortcut is meaningless on a touch device. */}
        <span className="hidden shrink-0 rounded border border-slate-400/20 px-1 py-0.5 text-[0.55rem] uppercase leading-none text-slate-400 lg:inline">
          Ctrl K
        </span>
      </button>

      {isOpen ? (
        <Modal onClose={closePalette} size="md" title="Command palette">
          <div className="orbit-hud-surface grid gap-4 rounded-lg">
            <div className="relative z-10 grid gap-4">
              <div>
                <label className="sr-only" htmlFor="command-palette-search">
                  Search commands
                </label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    autoFocus
                    className="orbit-input w-full py-2 pl-9 pr-3 text-sm"
                    id="command-palette-search"
                    onChange={(event) => {
                      setSuccessMessage("");
                      setQuery(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (navigableItems.length === 0) return;

                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setHighlightIndex((current) => Math.min(current + 1, navigableItems.length - 1));
                      }

                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setHighlightIndex((current) => Math.max(current - 1, 0));
                      }

                      if (event.key === "Enter") {
                        const target = navigableItems[highlightIndex];
                        if (target) {
                          event.preventDefault();
                          openRoute(target.to);
                        }
                      }
                    }}
                    placeholder="Search tasks, notes, missions..."
                    value={query}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Filter with{" "}
                  <code className="rounded bg-white/[0.06] px-1">is:note</code>{" "}
                  <code className="rounded bg-white/[0.06] px-1">tag:design</code>{" "}
                  <code className="rounded bg-white/[0.06] px-1">type:decision</code>
                </p>
              </div>

              <div className="grid gap-2">
                {trimmedQuery ? (
                  <button
                    aria-label={`Capture ${trimmedQuery}`}
                    className="orbit-button flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                    disabled={captureMutation.isPending}
                    onClick={captureQuery}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">Capture</span>
                        <span className="block truncate text-xs text-cyan-950/70">{trimmedQuery}</span>
                      </span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                  </button>
                ) : null}

                {filteredRouteCommands.map((commandItem, index) => (
                  <button
                    aria-label={`Open ${commandItem.label}`}
                    aria-selected={highlightIndex === index}
                    className={rowClassName(highlightIndex === index)}
                    key={commandItem.to}
                    onClick={() => openRoute(commandItem.to)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{commandItem.label}</span>
                      <span className="block truncate text-xs text-slate-400">{commandItem.description}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-200" />
                  </button>
                ))}
              </div>

              {groupedResults.map((group) => (
                <div className="grid gap-2" key={group.type}>
                  <h3 className="px-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                    {group.heading}
                  </h3>
                  {group.items.map((item) => {
                    const index = navigableItems.findIndex((entry) => entry.key === `${item.type}:${item.id}`);

                    return (
                      <button
                        aria-selected={highlightIndex === index}
                        className={rowClassName(highlightIndex === index)}
                        key={item.id}
                        onClick={() => openRoute(item.to)}
                        type="button"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">{item.title}</span>
                          {item.subtitle ? (
                            <span className="block truncate text-xs capitalize text-slate-400">{item.subtitle}</span>
                          ) : null}
                        </span>
                        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-200" />
                      </button>
                    );
                  })}
                </div>
              ))}

              {successMessage ? <p className="text-xs font-semibold text-emerald-200">{successMessage}</p> : null}
              {captureMutation.isError ? <p className="text-xs font-semibold text-rose-200">{captureError}</p> : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
