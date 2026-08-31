export type WorkspacePanels = { templates: boolean; rituals: boolean; recurring: boolean };

const defaultPanels: WorkspacePanels = { templates: true, rituals: true, recurring: true };

function storageKey(projectId: string) {
  return `orbitflo:workspace-panels:${projectId}`;
}

export function loadWorkspacePanels(projectId: string): WorkspacePanels {
  try {
    const stored = window.localStorage.getItem(storageKey(projectId));
    return stored ? { ...defaultPanels, ...JSON.parse(stored) } : defaultPanels;
  } catch {
    return defaultPanels;
  }
}

export function saveWorkspacePanels(projectId: string, panels: WorkspacePanels) {
  window.localStorage.setItem(storageKey(projectId), JSON.stringify(panels));
}
