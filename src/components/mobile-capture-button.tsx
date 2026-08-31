import { Plus } from "lucide-react";
import { useState } from "react";
import { GlobalQuickAdd } from "./global-quick-add";
import { Modal } from "./modal";

export function MobileCaptureButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Capture a thought"
        // bottom-20 clears the 64px tab bar beneath it.
        className="orbit-button fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full p-0 shadow-[0_10px_30px_rgba(2,8,23,0.55)] lg:hidden"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <Plus aria-hidden="true" className="h-6 w-6" />
      </button>

      {isOpen ? (
        <Modal onClose={() => setIsOpen(false)} size="sm" title="Capture">
          <GlobalQuickAdd />
        </Modal>
      ) : null}
    </>
  );
}
