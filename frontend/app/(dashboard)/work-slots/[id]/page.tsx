"use client";

import { WorkSlotDetail } from "@/components/work-slots/work-slot-detail";
import { useParams } from "next/navigation";

export default function WorkSlotDetailPage() {
  const params = useParams();
  const id = parseInt(String(params.id ?? ""), 10);
  if (!Number.isFinite(id) || id < 1) {
    return <p className="text-destructive">Noto‘g‘ri ID</p>;
  }
  return <WorkSlotDetail slotId={id} />;
}
