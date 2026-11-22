"use client";

import { Suspense } from "react";
import { TabelMarksWorkspace } from "@/components/tabel/tabel-marks-workspace";

export default function TabelMarksPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Загрузка…</div>}>
      <TabelMarksWorkspace onlyProblems={false} />
    </Suspense>
  );
}
