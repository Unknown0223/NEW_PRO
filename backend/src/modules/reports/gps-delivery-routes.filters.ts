import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  resolveFilterOptionsScope,
  staffWhereForFilterOptions
} from "../access/access-filter-options-scope";

function agentLabel(name: string, code: string | null) {
  const cleaned =
    name.replace(/^\+?\d{9,15}[\s\u00a0\u202f]+/, "").replace(/\s+/g, " ").trim() || name;
  const c = (code ?? "").trim();
  return c ? `${cleaned} (${c})` : cleaned;
}

export async function getGpsDeliveryRoutesFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const expeditors = await prisma.user.findMany({
    where: staffWhereForFilterOptions(tenantId, scope, "expeditor"),
    select: {
      id: true,
      name: true,
      code: true,
      branch: true,
      app_access: true,
      is_active: true
    },
    orderBy: { name: "asc" }
  });

  const branches = [
    ...new Set(
      expeditors
        .map((e) => (e.branch ?? "").trim())
        .filter((b) => b.length > 0)
    )
  ].sort((a, b) => a.localeCompare(b, "uz"));

  return {
    branches: branches.map((name) => ({ id: name, label: name })),
    expeditors: expeditors.map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code ?? "",
      branch: e.branch,
      app_access: e.app_access,
      is_active: e.is_active,
      label: agentLabel(e.name, e.code)
    }))
  };
}
