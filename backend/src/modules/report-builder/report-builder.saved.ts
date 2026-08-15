import { prisma } from "../../config/database";
import type { Prisma } from "@prisma/client";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import {
  assertIsVoided,
  assertNotVoided,
  softRestoreData,
  softVoidData,
  softVoidListFilter
} from "../../lib/soft-void";
import type { ReportBuilderConfigPayload } from "./report-builder.types";
import { DATASET_ORDERS_SALES_LINES } from "./report-builder.constants";

/** Legacy pivot konfig yoki WebDataRocks `getReport()` JSON. */
export type ReportBuilderSavedConfigUnion = ReportBuilderConfigPayload | Record<string, unknown>;

export type SavedReportRow = {
  id: number;
  name: string;
  dataset_id: string;
  config: ReportBuilderSavedConfigUnion;
  updated_at: string;
  deleted_at?: string | null;
};

function parseConfigJson(raw: unknown): ReportBuilderSavedConfigUnion {
  if (!raw || typeof raw !== "object") {
    throw new Error("INVALID_CONFIG");
  }
  return raw as ReportBuilderSavedConfigUnion;
}

function savedConfigDatasetId(c: ReportBuilderSavedConfigUnion): string {
  if ("datasetId" in c && typeof (c as ReportBuilderConfigPayload).datasetId === "string") {
    const d = String((c as ReportBuilderConfigPayload).datasetId).trim();
    if (d) return d;
  }
  return DATASET_ORDERS_SALES_LINES;
}

export async function listReportBuilderSaved(
  tenantId: number,
  userId: number,
  opts?: { archive?: boolean }
): Promise<SavedReportRow[]> {
  const rows = await prisma.reportBuilderSavedConfig.findMany({
    where: { tenant_id: tenantId, user_id: userId, ...softVoidListFilter(opts?.archive) },
    orderBy: { updated_at: "desc" },
    take: 100,
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true, deleted_at: true }
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString(),
    deleted_at: r.deleted_at?.toISOString() ?? null
  }));
}

export async function getReportBuilderSaved(
  tenantId: number,
  userId: number,
  id: number
): Promise<SavedReportRow | null> {
  const r = await prisma.reportBuilderSavedConfig.findFirst({
    where: { id, tenant_id: tenantId, user_id: userId, deleted_at: null },
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true, deleted_at: true }
  });
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString(),
    deleted_at: null
  };
}

export async function createReportBuilderSaved(
  tenantId: number,
  userId: number,
  name: string,
  config: ReportBuilderSavedConfigUnion
): Promise<SavedReportRow> {
  const trimmed = name.trim().slice(0, 200);
  if (!trimmed) throw new Error("EMPTY_NAME");
  const r = await prisma.reportBuilderSavedConfig.create({
    data: {
      tenant_id: tenantId,
      user_id: userId,
      name: trimmed,
      dataset_id: savedConfigDatasetId(config),
      config: config as unknown as Prisma.InputJsonValue
    },
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true, deleted_at: true }
  });
  return {
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString(),
    deleted_at: null
  };
}

export async function updateReportBuilderSaved(
  tenantId: number,
  userId: number,
  id: number,
  patch: { name?: string; config?: ReportBuilderSavedConfigUnion }
): Promise<SavedReportRow | null> {
  const existing = await prisma.reportBuilderSavedConfig.findFirst({
    where: { id, tenant_id: tenantId, user_id: userId }
  });
  if (!existing) return null;
  assertNotVoided(existing);
  const name = patch.name != null ? patch.name.trim().slice(0, 200) : existing.name;
  if (!name) throw new Error("EMPTY_NAME");
  const config = patch.config ?? parseConfigJson(existing.config);
  const r = await prisma.reportBuilderSavedConfig.update({
    where: { id },
    data: {
      name,
      dataset_id: savedConfigDatasetId(config),
      config: config as unknown as Prisma.InputJsonValue
    },
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true, deleted_at: true }
  });
  return {
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString(),
    deleted_at: r.deleted_at?.toISOString() ?? null
  };
}

export async function deleteReportBuilderSaved(tenantId: number, userId: number, id: number): Promise<boolean> {
  const existing = await prisma.reportBuilderSavedConfig.findFirst({
    where: { id, tenant_id: tenantId, user_id: userId },
    select: { id: true, deleted_at: true }
  });
  if (!existing) return false;
  assertNotVoided(existing);
  await prisma.reportBuilderSavedConfig.update({
    where: { id },
    data: softVoidData(userId, null, { includeReason: false })
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: userId,
    entityType: "report_builder",
    entityId: id,
    action: "report_builder.void",
    payload: { saved_id: id, soft: true }
  });
  return true;
}

export async function restoreReportBuilderSaved(tenantId: number, userId: number, id: number): Promise<boolean> {
  const existing = await prisma.reportBuilderSavedConfig.findFirst({
    where: { id, tenant_id: tenantId, user_id: userId },
    select: { id: true, deleted_at: true }
  });
  if (!existing) return false;
  assertIsVoided(existing);
  await prisma.reportBuilderSavedConfig.update({
    where: { id },
    data: softRestoreData({ includeReason: false })
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: userId,
    entityType: "report_builder",
    entityId: id,
    action: "report_builder.restore",
    payload: { saved_id: id }
  });
  return true;
}
