import { ChevronRight, Plus } from "lucide-react";
import { memo, useState } from "react";
import { mapTemplates } from "./map-templates";
import { TemplateThumbnail } from "./map-template-thumbnail";

const visibleTemplateCount = 4;

type MapLibraryPanelProps = {
  isCreating: boolean;
  onCreateBlank: () => void;
  onCreateFromTemplate: (templateId: string) => void;
};

export const MapLibraryPanel = memo(function MapLibraryPanel({
  isCreating,
  onCreateBlank,
  onCreateFromTemplate,
}: MapLibraryPanelProps) {
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const templates = showAllTemplates ? mapTemplates : mapTemplates.slice(0, visibleTemplateCount);

  return (
    <aside
      aria-label="Map templates"
      className="surface-whisper sticky top-8 grid max-h-[calc(100vh-10rem)] gap-3 self-start overflow-hidden rounded-xl p-3"
    >
      <button
        className="orbit-button-secondary justify-center"
        disabled={isCreating}
        onClick={onCreateBlank}
        type="button"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        New blank map
      </button>

      <p className="px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-500">Templates</p>
      <div className="orbit-scrollbar grid content-start gap-2 overflow-y-auto pr-1">
        {templates.map((template) => (
          <button
            aria-label={`${template.title}: ${template.description}`}
            className="map-template-card"
            disabled={isCreating}
            key={template.id}
            onClick={() => onCreateFromTemplate(template.id)}
            type="button"
          >
            <TemplateThumbnail edges={template.edges} nodes={template.nodes} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{template.title}</span>
              <span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{template.description}</span>
            </span>
          </button>
        ))}
      </div>
      {mapTemplates.length > visibleTemplateCount ? (
        <button
          aria-expanded={showAllTemplates}
          className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-cyan-200 transition hover:text-cyan-100"
          onClick={() => setShowAllTemplates((current) => !current)}
          type="button"
        >
          {showAllTemplates ? "Show fewer templates" : "Browse all templates"}
          <ChevronRight aria-hidden="true" className={showAllTemplates ? "h-3.5 w-3.5 rotate-90" : "h-3.5 w-3.5"} />
        </button>
      ) : null}
    </aside>
  );
});
