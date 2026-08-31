import type { WorkspaceSummary } from "./workspaces.queries";

/**
 * The stored id is only a hint — it survives losing access to a workspace, so
 * it is honoured only when it is still in the caller's list. Null means the
 * caller has no workspace yet and one must be created.
 */
export function resolveWorkspaceId(
  workspaces: WorkspaceSummary[],
  storedId: string | null,
): string | null {
  if (workspaces.length === 0) return null;
  if (storedId && workspaces.some((workspace) => workspace.id === storedId)) return storedId;
  return workspaces[0].id;
}
