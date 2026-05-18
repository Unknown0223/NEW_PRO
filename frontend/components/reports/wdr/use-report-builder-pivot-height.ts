"use client";

import { useEffect, useState } from "react";

const PIVOT_HEIGHT_MIN = 400;
const PIVOT_HEIGHT_MAX = 900;
const PIVOT_HEIGHT_VH = 0.62;

export function useReportBuilderPivotHeight(): number {
  const [px, setPx] = useState(520);
  useEffect(() => {
    const compute = () => {
      setPx(
        Math.min(PIVOT_HEIGHT_MAX, Math.max(PIVOT_HEIGHT_MIN, Math.round(window.innerHeight * PIVOT_HEIGHT_VH)))
      );
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return px;
}
