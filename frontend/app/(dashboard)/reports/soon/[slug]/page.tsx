"use client";

import { useParams } from "next/navigation";
import { ReportPlaceholder } from "@/components/reports/report-placeholder";
import { reportStubTitle } from "@/lib/report-menu-stubs";

export default function ReportStubPage() {
  const params = useParams();
  const raw = params.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  return <ReportPlaceholder title={reportStubTitle(slug ?? "")} />;
}
