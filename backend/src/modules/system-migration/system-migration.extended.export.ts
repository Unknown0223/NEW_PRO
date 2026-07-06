import { prisma } from "../../config/database";
import {
  ALL_EXTENDED_FILES,
  EXTENDED_IMPORT_PHASES,
  type ExtendedExportScope,
  type ExtendedTableSpec
} from "./system-migration.extended-specs";

function exportWhere(tenantId: number, scope: ExtendedExportScope = "tenant"): Record<string, unknown> {
  switch (scope) {
    case "territory":
      return { territory: { tenant_id: tenantId } };
    case "warehouse":
      return { warehouse: { tenant_id: tenantId } };
    case "cash_desk":
      return { cash_desk: { tenant_id: tenantId } };
    case "group":
      return { group: { tenant_id: tenantId } };
    case "role":
      return { role: { tenant_id: tenantId } };
    case "user":
      return { user: { tenant_id: tenantId } };
    case "stock_take":
      return { stock_take: { tenant_id: tenantId } };
    case "correction":
      return { document: { tenant_id: tenantId } };
    case "block":
      return { block: { tenant_id: tenantId } };
    case "client_balance":
      return { client_balance: { tenant_id: tenantId } };
    default:
      return { tenant_id: tenantId };
  }
}

async function exportExtendedTable(tenantId: number, spec: ExtendedTableSpec): Promise<unknown[]> {
  const delegate = (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]> }>)[
    spec.delegate
  ];
  if (!delegate?.findMany) return [];
  const where = exportWhere(tenantId, spec.scope ?? "tenant");
  return delegate.findMany({ where });
}

export async function loadExtendedTables(tenantId: number): Promise<Record<string, unknown[]>> {
  const specs = EXTENDED_IMPORT_PHASES.flat();
  const entries = await Promise.all(
    specs.map(async (spec) => [spec.file, await exportExtendedTable(tenantId, spec)] as const)
  );
  return Object.fromEntries(entries);
}

export function extendedDataFilePaths(): string[] {
  return ALL_EXTENDED_FILES.map((f) => `data/${f}.json`);
}
