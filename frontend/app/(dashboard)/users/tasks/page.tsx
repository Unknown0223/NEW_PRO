"use client";

import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function TasksPageInner() {
  const sp = useSearchParams();
  const id = Number.parseInt(sp.get("id") ?? "", 10);
  return <TasksWorkspace initialTaskId={Number.isFinite(id) && id > 0 ? id : null} />;
}

export default function UsersTasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageInner />
    </Suspense>
  );
}
