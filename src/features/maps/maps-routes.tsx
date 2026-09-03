import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useWorkspaceId } from "../workspaces/workspace-context";
import { workspacePath } from "../workspaces/workspace-path";
import { MapEditorPage } from "./map-editor-page";
import { MapLibraryPage } from "./map-library-page";

export function MapsLibraryRoute() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  return <MapLibraryPage onOpenMap={(mapId) => navigate(workspacePath(workspaceId, `/maps/${mapId}`))} />;
}

export function MapsEditorRoute() {
  const { mapId } = useParams();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  if (!mapId) return <Navigate replace to={workspacePath(workspaceId, "/maps")} />;
  return <MapEditorPage key={mapId} mapId={mapId} onBack={() => navigate(workspacePath(workspaceId, "/maps"))} />;
}
