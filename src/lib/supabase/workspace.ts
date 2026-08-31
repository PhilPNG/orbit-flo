const STORAGE_KEY = "project-command-center:workspace-id";

export function getStoredWorkspaceId(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredWorkspaceId(workspaceId: string): void {
  window.localStorage.setItem(STORAGE_KEY, workspaceId);
}

export function clearStoredWorkspaceId(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
