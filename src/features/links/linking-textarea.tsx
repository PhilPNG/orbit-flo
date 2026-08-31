import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { supabase } from "../../lib/supabase/client";
import { listMembers, membersQueryKey } from "../members/members.queries";
import { minSearchLength, searchKeys, searchWorkspace } from "../search/search.queries";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { findTrigger, replaceTrigger, type ActiveTrigger } from "./link-trigger";
import { formatMention } from "./mention";
import { formatOrbitLink } from "./orbit-link";

/** The shape both sources (search results, workspace members) reduce to for rendering. */
type Option = { id: string; label: string; type: string; insert: string };

/**
 * A plain textarea that offers a picker when you type `[[`. Deliberately not a
 * rich text editor: the body stays markdown the author can see and edit.
 */
export function LinkingTextarea({
  value,
  onChange,
  ...textareaProps
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<"textarea">, "value" | "onChange">) {
  const workspaceId = useWorkspaceId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<ActiveTrigger | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const term = trigger?.query.trim() ?? "";

  const resultsQuery = useQuery({
    queryKey: searchKeys.workspace(workspaceId, term),
    queryFn: () => searchWorkspace(supabase, workspaceId, term),
    enabled: trigger?.kind === "link" && term.length >= minSearchLength,
  });

  // The member list is small and already fetched, so a bare `@` shows
  // everyone rather than gating on a minimum query length like the link
  // source does.
  const membersQuery = useQuery({
    queryKey: membersQueryKey(workspaceId),
    queryFn: () => listMembers(supabase, workspaceId),
    enabled: trigger?.kind === "mention",
  });

  // A failed search/fetch closes the picker rather than blocking the field:
  // typing `[[` or `@` then simply does nothing.
  const options: Option[] =
    trigger?.kind === "mention"
      ? (membersQuery.data ?? [])
          .filter((member) => member.displayName.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 6)
          .map((member) => ({
            id: member.userId,
            label: member.displayName,
            type: "member",
            insert: formatMention(member.userId, member.displayName),
          }))
      : (resultsQuery.data ?? []).slice(0, 6).map((result) => ({
          id: result.id,
          label: result.title,
          type: result.type,
          insert: formatOrbitLink(result.type, result.id, result.title),
        }));

  function syncTrigger(element: HTMLTextAreaElement) {
    const next = findTrigger(element.value, element.selectionStart ?? 0);
    setTrigger(next);
    setHighlighted(0);
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
    syncTrigger(event.target);
  }

  function choose(index: number) {
    const option = options[index];
    const element = textareaRef.current;
    if (!option || !trigger || !element) return;

    const next = replaceTrigger(
      value,
      trigger,
      element.selectionStart ?? value.length,
      option.insert,
    );

    onChange(next.body);
    setTrigger(null);

    // Put the caret after the inserted text so typing continues naturally.
    window.requestAnimationFrame(() => {
      element.setSelectionRange(next.caret, next.caret);
      element.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!trigger || options.length === 0) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setTrigger(null);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => (current + 1) % options.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => (current - 1 + options.length) % options.length);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      choose(highlighted);
    }
  }

  return (
    <div className="relative">
      <textarea
        {...textareaProps}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(event) => syncTrigger(event.currentTarget)}
        ref={textareaRef}
        value={value}
      />

      {trigger && options.length > 0 ? (
        <ul
          aria-label={trigger.kind === "mention" ? "Mention" : "Link to"}
          className="absolute left-0 right-0 top-full z-20 mt-1 grid gap-0.5 rounded-lg border border-white/[0.08] bg-[#050d20] p-1 shadow-xl"
          role="listbox"
        >
          {options.map((option, index) => (
            <li key={`${option.type}:${option.id}`}>
              <button
                aria-selected={index === highlighted}
                className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                  index === highlighted ? "bg-white/[0.07] text-white" : "text-slate-300"
                }`}
                onClick={() => choose(index)}
                onMouseEnter={() => setHighlighted(index)}
                role="option"
                type="button"
              >
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {option.type}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
