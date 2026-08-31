import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapLibraryPanel } from "./map-library-panel";
import { mapTemplates } from "./map-templates";

function templateButtons() {
  return screen
    .getAllByRole("button")
    .filter((button) => mapTemplates.some((template) => button.textContent?.includes(template.title)));
}

describe("MapLibraryPanel", () => {
  it("renders every complete template card and returns its id", async () => {
    const user = userEvent.setup();
    const onCreateFromTemplate = vi.fn();
    render(
      <MapLibraryPanel
        isCreating={false}
        onCreateBlank={() => undefined}
        onCreateFromTemplate={onCreateFromTemplate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Browse all templates/ }));

    const panel = screen.getByRole("complementary", { name: "Map templates" });
    const meetingDescription = screen.getByText("Capture a meeting topic, decisions, and follow-up actions.");

    expect(templateButtons()).toHaveLength(mapTemplates.length);
    expect(meetingDescription).toBeVisible();
    expect(meetingDescription).toHaveClass("line-clamp-2");
    expect(meetingDescription).not.toHaveClass("truncate");
    expect(panel.querySelector(".orbit-scrollbar")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Feature plan/ }));
    expect(onCreateFromTemplate).toHaveBeenCalledWith("feature-plan");
  });

  it("shows a short template list until the gallery is expanded", async () => {
    const user = userEvent.setup();
    render(
      <MapLibraryPanel
        isCreating={false}
        onCreateBlank={() => undefined}
        onCreateFromTemplate={() => undefined}
      />,
    );

    expect(templateButtons()).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: /Browse all templates/ }));
    expect(templateButtons()).toHaveLength(mapTemplates.length);

    await user.click(screen.getByRole("button", { name: /Show fewer templates/ }));
    expect(templateButtons()).toHaveLength(4);
  });
});
