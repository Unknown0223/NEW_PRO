"use client";

import { Suspense } from "react";
import { TaklifiyRejaGate } from "@/components/plans/taklifiy-reja/taklifiy-reja-gate";
import { TaklifiyRejaShell } from "@/components/plans/taklifiy-reja/taklifiy-reja-shell";

function Inner() {
  return (
    <TaklifiyRejaGate>
      <TaklifiyRejaShell tab="calculator" />
    </TaklifiyRejaGate>
  );
}

export default function TaklifiyRejaPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Загрузка…</p>}>
      <Inner />
    </Suspense>
  );
}
