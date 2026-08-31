import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { orbitAssets } from "../lib/orbit-assets";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the route-specific illustration without hiding copy", () => {
    render(<EmptyState illustration="inbox" title="Inbox clear" message="Nothing waiting." />);
    expect(screen.getByRole("img", { name: "Quiet orbital signal receiver" })).toHaveAttribute(
      "src",
      orbitAssets.illustrations.emptyInbox,
    );
    expect(screen.getByText("Inbox clear")).toBeVisible();
  });
});
