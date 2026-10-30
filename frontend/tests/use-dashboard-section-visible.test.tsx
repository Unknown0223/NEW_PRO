import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { act } from "react";
import { useDashboardSectionVisible } from "@/hooks/use-dashboard-section-visible";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
const observers: Array<{ cb: ObserverCallback; targets: Element[] }> = [];

class FakeIntersectionObserver {
  private record: { cb: ObserverCallback; targets: Element[] };
  constructor(cb: ObserverCallback) {
    this.record = { cb, targets: [] };
    observers.push(this.record);
  }
  observe(el: Element) {
    this.record.targets.push(el);
  }
  disconnect() {
    this.record.targets = [];
  }
}

function Harness({ showSection }: { showSection: boolean }) {
  const section = useDashboardSectionVisible({ enabled: true });
  return (
    <div>
      <span data-testid="visible">{String(section.visible)}</span>
      {showSection ? <div ref={section.ref}>section</div> : null}
    </div>
  );
}

function LateMount() {
  const [show, setShow] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setShow(true)}>
        mount
      </button>
      <Harness showSection={show} />
    </>
  );
}

describe("useDashboardSectionVisible", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("observes a section that mounts after the hook (client-side navigation)", () => {
    render(<LateMount />);
    expect(observers.some((o) => o.targets.length > 0)).toBe(false);

    act(() => {
      screen.getByText("mount").click();
    });
    const active = observers.find((o) => o.targets.length > 0);
    expect(active).toBeDefined();

    act(() => {
      active!.cb([{ isIntersecting: true }]);
    });
    expect(screen.getByTestId("visible").textContent).toBe("true");
  });
});
