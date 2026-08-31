import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import { setStoredWorkspaceId } from "../../lib/supabase/workspace";

// Exported for tests that need to mount consumers under a fixed workspace id
// without the full provider's bootstrapping.
export const WorkspaceContext = createContext<string | null>(null);

export function WorkspaceProvider({
  workspaceId,
  children,
}: PropsWithChildren<{ workspaceId: string }>) {
  // localStorage is no longer the source of truth — only the resolver's hint
  // for where to send someone who arrives at "/".
  useEffect(() => {
    setStoredWorkspaceId(workspaceId);
  }, [workspaceId]);

  return <WorkspaceContext.Provider value={workspaceId}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceId(): string {
  const workspaceId = useContext(WorkspaceContext);

  // Throwing beats returning "" — a missing provider becomes an immediate
  // failure instead of a query that silently matches nothing.
  if (!workspaceId) throw new Error("useWorkspaceId must be used inside a WorkspaceProvider.");

  return workspaceId;
}
