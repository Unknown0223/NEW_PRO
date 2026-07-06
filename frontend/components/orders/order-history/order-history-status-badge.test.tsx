import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderHistoryStatusBadge } from "./order-history-status-badge";

describe("OrderHistoryStatusBadge", () => {
  it("renders status label", () => {
    render(<OrderHistoryStatusBadge status="Подтверждён" statusKey="CONFIRMED" />);
    expect(screen.getByText("Подтверждён")).toBeVisible();
  });

  it("returns null when status is empty", () => {
    const { container } = render(<OrderHistoryStatusBadge status="" />);
    expect(container.firstChild).toBeNull();
  });

  it("applies known status color class for CONFIRMED", () => {
    render(<OrderHistoryStatusBadge status="Confirmed" statusKey="CONFIRMED" />);
    const badge = screen.getByText("Confirmed");
    expect(badge.className).toContain("amber");
  });
});
