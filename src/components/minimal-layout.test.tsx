import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader, QuietPanel } from "./minimal-layout";

describe("minimal layout", () => {
  it("uses the shared observatory header and quiet surface hooks", () => {
    const { container } = render(
      <>
        <PageHeader eyebrow="Mission registry" title="Projects in orbit.">
          Track active work.
        </PageHeader>
        <QuietPanel aria-label="Registry">Content</QuietPanel>
      </>,
    );

    expect(container.querySelector(".orbit-page-header")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Registry" })).toHaveClass("surface-quiet");
  });
});
