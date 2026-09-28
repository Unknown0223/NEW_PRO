"use client";

import { Suspense } from "react";
import { WorkSlotDetail } from "@/components/work-slots/work-slot-detail";
import { useParams } from "next/navigation";

function WorkSlotDetailInner() {
  const params = useParams();
  const id = parseInt(String(params.id ?? ""), 10);
  if (!Number.isFinite(id) || id < 1) {
    return <p className="text-destructive">Некорректный ID</p>;
  }
  return <WorkSlotDetail slotId={id} />;
}

export default function WorkSlotDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка…</p>}>
      <WorkSlotDetailInner />
    </Suspense>
  );
}
