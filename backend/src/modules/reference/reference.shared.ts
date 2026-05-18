import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export function settingsRefRecord(tenantId: number): Promise<Record<string, unknown>> {
  return prisma.tenant
    .findUnique({ where: { id: tenantId }, select: { settings: true } })
    .then((row) => {
      const st = row?.settings;
      if (st != null && typeof st === "object" && !Array.isArray(st)) {
        const refs = (st as Record<string, unknown>).references;
        if (refs != null && typeof refs === "object" && !Array.isArray(refs)) {
          return refs as Record<string, unknown>;
        }
      }
      return {};
    });
}
