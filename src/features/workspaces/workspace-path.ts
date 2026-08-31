/**
 * Nav tables keep workspace-relative paths so routePrefetchers stays keyed by
 * them; only the rendered href goes through here.
 */
export function workspacePath(workspaceId: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? `/w/${workspaceId}` : `/w/${workspaceId}${normalized}`;
}
