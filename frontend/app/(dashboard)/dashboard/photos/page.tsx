"use client";

import { SupervisorPhotoProPage } from "@/components/dashboard/supervisor/pro/supervisor-photo-pro-page";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PhotosPageInner() {
  const search = useSearchParams();
  const date = search.get("date") ?? undefined;
  const agent = search.get("agent") ?? undefined;
  return <SupervisorPhotoProPage initialDate={date} initialAgentId={agent} />;
}

export default function DashboardPhotosPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Загрузка…</p>}>
      <PhotosPageInner />
    </Suspense>
  );
}
