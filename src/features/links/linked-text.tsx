import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";
import type { LinkKind } from "./orbit-link";

/**
 * A target that has been deleted leaves its markup behind: the link row
 * cascades away but the text the author wrote stays. Showing that plainly
 * beats silently rewriting somebody's note.
 */
export type ResolvedTargets = Set<string>;

export function targetKey(kind: LinkKind, id: string) {
  return `${kind}:${id}`;
}

const orbitHref = /^orbit:(note|task|project|user|milestone)\/([0-9a-fA-F-]{36})$/;

function pathFor(workspaceId: string, kind: LinkKind, id: string) {
  if (kind === "task") return workspacePath(workspaceId, `/projects?task=${id}`);
  if (kind === "project") return workspacePath(workspaceId, `/projects/${id}`);
  if (kind === "milestone") return workspacePath(workspaceId, `/milestones/${id}`);
  return workspacePath(workspaceId, `/notes?note=${id}`);
}

/**
 * Renders a note body as markdown. Raw HTML is off — react-markdown's default —
 * so an untrusted body has no injection surface.
 *
 * orbit: links are ordinary markdown links, so they arrive here as anchors and
 * only need resolving. react-markdown strips unknown schemes through
 * urlTransform by default, which would silently kill every one of them.
 */
export function LinkedText({
  body,
  resolved,
}: {
  body: string;
  /** Targets known to still exist. Omit to treat every link as resolvable. */
  resolved?: ResolvedTargets;
}) {
  const workspaceId = useWorkspaceId();

  return (
    <Markdown
      components={{
        a({ href, children }) {
          const match = href ? orbitHref.exec(href) : null;

          if (!match) {
            return (
              <a
                className="font-semibold text-cyan-200 underline-offset-2 hover:text-cyan-100 hover:underline"
                href={href}
                rel="noreferrer"
                target="_blank"
              >
                {children}
              </a>
            );
          }

          if (match[1] === "user") {
            return (
              <span className="rounded bg-violet-400/15 px-1 font-semibold text-violet-100">
                {children}
              </span>
            );
          }

          const kind = match[1] as LinkKind;
          const id = match[2];

          if (resolved && !resolved.has(targetKey(kind, id))) {
            return (
              <span
                className="rounded border border-violet-300/30 bg-violet-400/10 px-1 text-violet-100 line-through decoration-violet-300/50"
                title="This link points at something that no longer exists"
              >
                {children}
              </span>
            );
          }

          return (
            <Link
              className="font-semibold text-cyan-200 underline-offset-2 hover:text-cyan-100 hover:underline"
              to={pathFor(workspaceId, kind, id)}
            >
              {children}
            </Link>
          );
        },
      }}
      remarkPlugins={[remarkGfm]}
      // Without this, react-markdown drops the orbit: scheme and the link is
      // rendered with no href at all.
      urlTransform={(url) => (orbitHref.test(url) ? url : defaultUrlTransform(url))}
    >
      {body}
    </Markdown>
  );
}

/** react-markdown's own allowlist, reproduced for everything that is not ours. */
function defaultUrlTransform(url: string) {
  const colon = url.indexOf(":");
  const questionMark = url.indexOf("?");
  const hash = url.indexOf("#");
  const slash = url.indexOf("/");

  const isRelative =
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (hash !== -1 && colon > hash);

  if (isRelative) return url;

  const scheme = url.slice(0, colon).toLowerCase();

  return ["http", "https", "mailto", "tel"].includes(scheme) ? url : "";
}
