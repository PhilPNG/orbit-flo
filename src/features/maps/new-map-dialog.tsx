import { useState } from "react";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { mapTemplates } from "./map-templates";
import { TemplateThumbnail } from "./map-template-thumbnail";

export type NewMapInput = { templateId: string | null; title: string };

type NewMapDialogProps = {
  isCreating: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: NewMapInput) => void;
};

const BLANK_TITLE = "Untitled map";

export function NewMapDialog({ isCreating, error, onClose, onCreate }: NewMapDialogProps) {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [title, setTitle] = useState(BLANK_TITLE);

  function choose(id: string | null, nextTitle: string) {
    setTemplateId(id);
    setTitle(nextTitle);
  }

  function submit() {
    if (isCreating) return;
    onCreate({ templateId, title: title.trim() || BLANK_TITLE });
  }

  return (
    <Modal onClose={onClose} size="md" title="New map">
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div aria-label="Start from" className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          <button
            aria-checked={templateId === null}
            className="map-template-card new-map-option"
            onClick={() => choose(null, BLANK_TITLE)}
            role="radio"
            type="button"
          >
            <span aria-hidden="true" className="map-card-thumbnail-placeholder h-[3.25rem] w-24 shrink-0 rounded-md" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">Blank map</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">Start with an empty canvas.</span>
            </span>
          </button>
          {mapTemplates.map((template) => (
            <button
              aria-checked={templateId === template.id}
              className="map-template-card new-map-option"
              key={template.id}
              onClick={() => choose(template.id, template.title)}
              role="radio"
              type="button"
            >
              <TemplateThumbnail edges={template.edges} nodes={template.nodes} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{template.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-400">{template.description}</span>
              </span>
            </button>
          ))}
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-200">Title</span>
          <input aria-label="Map title" className="orbit-input px-3 py-2" onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        <div className="flex justify-end gap-2">
          <button className="orbit-button-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="orbit-button" disabled={isCreating} type="submit">
            {isCreating ? "Creating…" : "Create map"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
