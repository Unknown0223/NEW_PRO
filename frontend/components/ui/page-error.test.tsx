import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageError } from "./page-error";

describe("PageError", () => {
  it("renders message and retry", () => {
    const onRetry = vi.fn();
    render(<PageError message="Ошибка загрузки" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
