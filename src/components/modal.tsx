import { clsx } from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { tabbable } from "tabbable";

const sizeClass = {
  sm: "max-w-lg",
  md: "max-w-3xl",
  lg: "max-w-5xl",
} as const;

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: keyof typeof sizeClass;
  className?: string;
};

function getTabbableElements(container: HTMLElement) {
  const options =
    typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom")
      ? { displayCheck: "none" as const }
      : undefined;

  return tabbable(container, options);
}

export function Modal({
  title,
  children,
  onClose,
  size = "sm",
  className,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    function getFocusableElements() {
      return dialogRef.current ? getTabbableElements(dialogRef.current) : [];
    }

    document.body.style.overflow = "hidden";
    getFocusableElements()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = getFocusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  // Portalled to the body so a modal is never trapped in an ancestor stacking
  // context. The command palette lives in the sidebar, which shares a z-index
  // with main, so an inline modal rendered underneath the page content.
  return createPortal(
    // The scroll container must not centre its own overflow: align-items on a
    // scrolling box pushes the excess outside the scrollable region, where it
    // is neither counted in scrollHeight nor reachable. A min-h-full wrapper
    // centres short content and simply grows past the viewport for tall.
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#020817]/86 backdrop-blur-md"
      data-modal-scrim
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <section
          ref={dialogRef}
          aria-labelledby={titleId}
          aria-modal="true"
          className={clsx(
            // dvh, not vh: mobile browser chrome makes vh taller than what you
            // can actually see.
            "surface-focus orbit-page-enter flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl",
            sizeClass[size],
            className,
          )}
          role="dialog"
          tabIndex={-1}
        >
          <div className="flex shrink-0 items-center justify-between p-6 pb-4">
            <h2 className="text-base font-semibold text-white" id={titleId}>
              {title}
            </h2>
            <button className="orbit-button-secondary px-2 py-1 text-xs" onClick={onClose} type="button">
              Close
            </button>
          </div>
          {/* min-h-0 lets this shrink inside the flex column so it, rather than
              the dialog, is what scrolls — keeping Close always reachable. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6" data-modal-body>
            {children}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
