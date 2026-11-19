"use client";

import { Suspense } from "react";
import { TaklifiyRejaGate } from "@/components/plans/taklifiy-reja/taklifiy-reja-gate";
import { TaklifiyRejaShell } from "@/components/plans/taklifiy-reja/taklifiy-reja-shell";

function Inner() {
  return (
    <TaklifiyRejaGate>
      <TaklifiyRejaShell tab="outcomes" />
    </TaklifiyRejaGate>
  );
}

export default function TaklifiyNatijalarPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Загрузка…</p>}>
      <Inner />
    </Suspense>
  );
}
