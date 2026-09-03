import { useSearchParams } from "react-router-dom";
import { MapEditorPage } from "./map-editor-page";
import { MapLibraryPage } from "./map-library-page";

export function ProjectMapsTab({ projectId }: { projectId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mapId = searchParams.get("map");

  function setMap(id: string | null) {
    const next = new URLSearchParams(searchParams);
    if (id) {
      next.set("map", id);
      setSearchParams(next);
    } else {
      next.delete("map");
      // Replace (not push) so Back from the library leaves Maps instead of reopening the editor.
      setSearchParams(next, { replace: true });
    }
  }

  return mapId ? (
    <MapEditorPage key={mapId} mapId={mapId} onBack={() => setMap(null)} projectId={projectId} />
  ) : (
    <MapLibraryPage onOpenMap={setMap} projectId={projectId} />
  );
}
