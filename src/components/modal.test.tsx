import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Modal } from "./modal";

describe("Modal", () => {
  it("applies an optional class name to the dialog", () => {
    render(
      <Modal className="modal-override" onClose={() => undefined} title="Task details">
        Details
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toHaveClass("modal-override");
  });

  it("closes on Escape and restores focus", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <>
          <button onClick={() => setIsOpen(true)} type="button">
            Open details
          </button>
          {isOpen ? (
            <Modal onClose={() => setIsOpen(false)} size="lg" title="Task details">
              <button type="button">Save task</button>
            </Modal>
          ) : null}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open details" });

    await user.click(opener);
    expect(screen.getByRole("dialog")).toHaveClass("max-w-5xl");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("contains keyboard focus within the dialog", async () => {
    const user = userEvent.setup();

    render(
      <Modal onClose={() => undefined} title="Task details">
        <button type="button">Save task</button>
      </Modal>,
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    const saveButton = screen.getByRole("button", { name: "Save task" });
    expect(closeButton).toHaveFocus();

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(saveButton).toHaveFocus();

    await user.keyboard("{Tab}");
    expect(closeButton).toHaveFocus();
  });

  it("skips controls inside a disabled fieldset when wrapping focus", async () => {
    const user = userEvent.setup();

    render(
      <Modal onClose={() => undefined} title="Task details">
        <button type="button">Save task</button>
        <fieldset disabled>
          <button type="button">Unavailable action</button>
        </fieldset>
      </Modal>,
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    const saveButton = screen.getByRole("button", { name: "Save task" });
    saveButton.focus();
    expect(saveButton).toHaveFocus();

    await user.keyboard("{Tab}");
    expect(closeButton).toHaveFocus();
  });

  it("restores the previous body overflow when it unmounts", () => {
    document.body.style.overflow = "clip";
    const { unmount } = render(
      <Modal onClose={() => undefined} title="Task details">
        Details
      </Modal>,
    );

    expect(document.body).toHaveStyle({ overflow: "hidden" });

    unmount();
    expect(document.body).toHaveStyle({ overflow: "clip" });
    document.body.style.overflow = "";
  });

  it("keeps tall content reachable instead of centring it out of the scroll range", () => {
    const { container } = render(
      <Modal onClose={() => undefined} title="Task details">
        <p>Body</p>
      </Modal>,
    );

    const scrim = container.ownerDocument.querySelector("[data-modal-scrim]") as HTMLElement;

    // align-items:center on the scroll container itself puts the overflow
    // outside the scrollable region, where no amount of scrolling reaches it.
    expect(scrim).not.toHaveClass("place-items-center");
    expect(scrim.className).toContain("overflow-y-auto");

    // A min-height wrapper centres while still growing past the viewport.
    const wrapper = scrim.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("min-h-full");
    expect(wrapper.className).toContain("items-center");
  });

  it("keeps the header visible while the body scrolls", () => {
    render(
      <Modal onClose={() => undefined} title="Task details">
        <p>Body</p>
      </Modal>,
    );

    const close = screen.getByRole("button", { name: "Close" });
    const body = screen.getByText("Body").closest("[data-modal-body]");

    expect(body).not.toBeNull();
    expect((body as HTMLElement).className).toContain("overflow-y-auto");
    // The header must sit outside the scrolling region so Close never leaves.
    expect(body?.contains(close)).toBe(false);
  });
});
