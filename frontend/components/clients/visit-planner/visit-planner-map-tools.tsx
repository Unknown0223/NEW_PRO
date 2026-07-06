"use client";

import type { VisitMapControls } from "@/components/clients/visit-planner/visit-planner-yandex-map";
import type { RefObject } from "react";

type Props = {
  controlsRef: RefObject<VisitMapControls | null>;
  showLasso?: boolean;
  lassoActive?: boolean;
  onLassoToggle?: () => void;
};

export function VisitPlannerMapTools({
  controlsRef,
  showLasso = false,
  lassoActive = false,
  onLassoToggle
}: Props) {
  return (
    <div className="vp-tools">
      <button type="button" className="vp-tool" title="Yaqinlashtirish" onClick={() => controlsRef.current?.zoomIn()}>
        +
      </button>
      <button type="button" className="vp-tool" title="Uzoqlashtirish" onClick={() => controlsRef.current?.zoomOut()}>
        −
      </button>
      <button type="button" className="vp-tool" title="Barchasini ko‘rsatish" onClick={() => controlsRef.current?.fitAll()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {showLasso && onLassoToggle ? (
        <button
          type="button"
          className={`vp-tool${lassoActive ? " vp-active" : ""}`}
          title="Probel bosib chizing"
          onClick={onLassoToggle}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 14c0-4.4 3.6-8 8-8 5.5 0 9 2.8 9 6.5S17 19 11 19c-3.9 0-7-1.5-7-5Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path d="M8 14c1.7 1.2 5.2 1.8 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
