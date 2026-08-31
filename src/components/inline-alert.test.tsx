import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineAlert } from "./inline-alert";

describe("InlineAlert", () => {
  it("renders an error alert", () => {
    render(<InlineAlert tone="error">Docking bay offline</InlineAlert>);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Docking bay offline");
    expect(alert).toHaveClass("border-rose-300/25", "bg-rose-300/10", "text-rose-100");
  });

  it("renders a success status with extra classes", () => {
    render(
      <InlineAlert className="daily-capture-dock" tone="success">
        Signal docked.
      </InlineAlert>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Signal docked.");
    expect(status).toHaveClass("daily-capture-dock", "border-emerald-300/25", "bg-emerald-300/10", "text-emerald-100");
  });
});
