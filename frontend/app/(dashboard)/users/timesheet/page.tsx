"use client";

import { TimesheetWorkspace } from "@/components/timesheet/timesheet-workspace";

export default function UsersTimesheetPage() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Табель</h1>
      </div>
      <TimesheetWorkspace />
    </div>
  );
}
