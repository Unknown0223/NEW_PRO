import { prisma } from "../../config/database";
import type { Prisma } from "@prisma/client";
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

export async function listReportBuilderSaved(tenantId: number, userId: number): Promise<SavedReportRow[]> {
  const rows = await prisma.reportBuilderSavedConfig.findMany({
    where: { tenant_id: tenantId, user_id: userId },
    orderBy: { updated_at: "desc" },
    take: 100,
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true }
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString()
  }));
}

export async function getReportBuilderSaved(
  tenantId: number,
  userId: number,
  id: number
): Promise<SavedReportRow | null> {
  const r = await prisma.reportBuilderSavedConfig.findFirst({
    where: { id, tenant_id: tenantId, user_id: userId },
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true }
  });
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString()
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
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true }
  });
  return {
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString()
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
    select: { id: true, name: true, dataset_id: true, config: true, updated_at: true }
  });
  return {
    id: r.id,
    name: r.name,
    dataset_id: r.dataset_id,
    config: parseConfigJson(r.config),
    updated_at: r.updated_at.toISOString()
  };
}

export async function deleteReportBuilderSaved(tenantId: number, userId: number, id: number): Promise<boolean> {
  const r = await prisma.reportBuilderSavedConfig.deleteMany({
    where: { id, tenant_id: tenantId, user_id: userId }
  });
  return r.count > 0;
}
