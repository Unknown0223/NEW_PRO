import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="Нет данных" description="Измените фильтры" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Нет данных")).toBeInTheDocument();
    expect(screen.getByText("Измените фильтры")).toBeInTheDocument();
  });
});
