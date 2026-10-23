import { describe, expect, it } from "vitest";
import { scrollEdgeVisibility } from "@/lib/scroll-edge-visibility";

describe("scrollEdgeVisibility", () => {
  it("qisqa kontentda belgi yo‘q", () => {
    expect(scrollEdgeVisibility(0, 200, 400)).toEqual({ up: false, down: false });
  });

  it("tepa va pastda alohida ko‘rinadi", () => {
    expect(scrollEdgeVisibility(0, 800, 300)).toEqual({ up: false, down: true });
    expect(scrollEdgeVisibility(250, 800, 300)).toEqual({ up: true, down: true });
    expect(scrollEdgeVisibility(500, 800, 300)).toEqual({ up: true, down: false });
  });
});
