"use client";

import { REPORT_STUB_FALLBACK_REASON } from "@/lib/report-menu-stubs";

export function ReportPlaceholder({ title, reason }: { title: string; reason?: string }) {
  const text = reason?.trim() ? reason : REPORT_STUB_FALLBACK_REASON;
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
