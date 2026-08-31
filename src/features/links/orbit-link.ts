export type LinkKind = "note" | "task" | "project" | "milestone";

export type OrbitLink = {
  kind: LinkKind;
  id: string;
  label: string;
};

const linkKinds: readonly LinkKind[] = ["note", "task", "project", "milestone"];

// Ordinary markdown, which is why the renderer needs no custom syntax — these
// arrive as plain anchors. The uuid shape keeps stray text out of the link
// table, and requiring the exact orbit: prefix keeps a URL that merely
// contains the word from matching.
const orbitLinkPattern =
  /\[([^\]]*)\]\(orbit:(note|task|project|milestone)\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)/g;

function isLinkKind(value: string): value is LinkKind {
  return (linkKinds as readonly string[]).includes(value);
}

/** Brackets in a label would terminate the markdown link early. */
function safeLabel(label: string) {
  return label.replaceAll("[", "(").replaceAll("]", ")");
}

export function formatOrbitLink(kind: LinkKind, id: string, label: string): string {
  return `[${safeLabel(label)}](orbit:${kind}/${id})`;
}

/** One entry per target, in the order they first appear. */
export function extractOrbitLinks(body: string): OrbitLink[] {
  const seen = new Set<string>();
  const links: OrbitLink[] = [];

  for (const match of body.matchAll(orbitLinkPattern)) {
    const [, label, kind, id] = match;
    if (!isLinkKind(kind)) continue;

    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;

    seen.add(key);
    links.push({ kind, id, label });
  }

  return links;
}
