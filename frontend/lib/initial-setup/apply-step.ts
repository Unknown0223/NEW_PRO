import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import type { InitialSetupPreviewState, InitialSetupStep } from "@/lib/initial-setup/types";
import { buildXlsxBlobFromPreview } from "@/lib/initial-setup/preview-xlsx";
import { getStepTableConfig } from "@/lib/initial-setup/ref-table-config";
import { sortStepsByFlowOrder, isStepReady } from "@/lib/initial-setup/flow-order";
import { runImportStep, type ImportAsyncCallbacks } from "@/lib/initial-setup/import-async";

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cell(row: InitialSetupPreviewState["rows"][0], key: string): string {
  const nk = key.toLowerCase().replace(/\s+/g, "_");
  return String(row.cells[nk] ?? row.cells[key] ?? "").trim();
}

function parseSort(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function truthy01(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "да" || s === "ha" || s === "yes";
}

async function invalidateAfterApply(tenantSlug: string, qc: QueryClient | undefined, extra: string[] = []) {
  const keys = [
    ["settings", "profile", tenantSlug],
    ["initial-setup-readonly", tenantSlug],
    ["clients-references", tenantSlug],
    ["trade-directions", tenantSlug],
    ["sales-channels-catalog", tenantSlug],
    ["product-categories", tenantSlug],
    ...extra.map((k) => [k, tenantSlug])
  ];
  for (const key of keys) {
    await qc?.invalidateQueries({ queryKey: key });
  }
  await qc?.invalidateQueries({ queryKey: ["initial-setup-readonly"] });
  await qc?.refetchQueries({ queryKey: ["settings", "profile", tenantSlug] });
}

function refRowKey(item: Record<string, unknown>): string {
  const code = String(item.code ?? "").trim().toLowerCase();
  const name = String(item.name ?? "").trim().toLowerCase();
  const id = String(item.id ?? "").trim();
  return code || name || id || "";
}

async function mergeWithExistingReferences(
  tenantSlug: string,
  profileRefKey: string,
  incoming: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const { data } = await api.get<{ references?: Record<string, unknown[]> }>(
    `/api/${tenantSlug}/settings/profile`
  );
  const existing = (data.references?.[profileRefKey] ?? []).filter(
    (x) => x != null && typeof x === "object" && !Array.isArray(x)
  ) as Record<string, unknown>[];

  const map = new Map<string, Record<string, unknown>>();
  for (const item of existing) {
    const k = refRowKey(item);
    if (k) map.set(k, { ...item });
  }
  for (const item of incoming) {
    const k = refRowKey(item);
    if (!k) continue;
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, ...item, id: prev.id ?? item.id } : item);
  }
  return Array.from(map.values());
}

export async function applyProfileRows(
  tenantSlug: string,
  profileRefKey: string,
  preview: InitialSetupPreviewState,
  qc?: QueryClient
): Promise<string> {
  let payload: unknown[];

  if (profileRefKey === "unit_measures") {
    payload = preview.rows.map((r) => ({
      id: cell(r, "_id") || newId("u"),
      name: cell(r, "name"),
      title: cell(r, "title") || cell(r, "name"),
      code: cell(r, "code") || null,
      sort_order: parseSort(cell(r, "sort_order")),
      comment: cell(r, "comment") || null,
      active: true
    }));
  } else if (profileRefKey === "currency_entries") {
    const rows = preview.rows.map((r, i) => ({
      id: cell(r, "_id") || newId("cur"),
      name: cell(r, "name"),
      code: cell(r, "code").toUpperCase(),
      sort_order: parseSort(cell(r, "sort_order")),
      active: true,
      is_default: truthy01(cell(r, "is_default")) || i === 0
    }));
    const def = rows.find((x) => x.is_default)?.id ?? rows[0]?.id;
    payload = rows.map((x) => ({ ...x, is_default: x.id === def }));
  } else if (profileRefKey === "payment_method_entries") {
    const profile = await api.get<{ references?: { currency_entries?: { code: string }[] } }>(
      `/api/${tenantSlug}/settings/profile`
    );
    const defaultCur =
      profile.data.references?.currency_entries?.find((c) => c.code)?.code?.toUpperCase() ?? "UZS";
    payload = preview.rows.map((r) => ({
      id: cell(r, "_id") || newId("pay"),
      name: cell(r, "name"),
      code: cell(r, "code").toUpperCase() || null,
      currency_code: (cell(r, "currency_code") || defaultCur).toUpperCase(),
      sort_order: parseSort(cell(r, "sort_order")),
      comment: cell(r, "comment") || null,
      color: null,
      active: true
    }));
  } else if (profileRefKey === "price_type_entries") {
    payload = preview.rows.map((r) => ({
      id: cell(r, "_id") || newId("pt"),
      name: cell(r, "name"),
      code: cell(r, "code").toUpperCase(),
      sort_order: parseSort(cell(r, "sort_order")),
      comment: cell(r, "comment") || null,
      active: true
    }));
  } else if (profileRefKey === "branches") {
    payload = preview.rows.map((r) => ({
      id: cell(r, "_id") || newId("b"),
      name: cell(r, "name"),
      code: cell(r, "code") || null,
      sort_order: parseSort(cell(r, "sort_order")),
      active: true
    }));
  } else if (profileRefKey === "territory_nodes") {
    type Node = {
      id: string;
      name: string;
      code?: string | null;
      comment?: string | null;
      sort_order?: number | null;
      active?: boolean;
      children: Node[];
    };
    const byName = new Map<string, Node>();
    const roots: Node[] = [];
    const ordered = preview.rows.filter((r) => cell(r, "name"));
    for (const r of ordered) {
      const name = cell(r, "name");
      const node: Node = {
        id: cell(r, "_id") || newId("terr"),
        name,
        code: cell(r, "code") || null,
        comment: cell(r, "level") || null,
        sort_order: parseSort(cell(r, "sort_order")),
        active: true,
        children: []
      };
      byName.set(name.toLowerCase(), node);
    }
    for (const r of ordered) {
      const name = cell(r, "name");
      const parentName = cell(r, "parent");
      const node = byName.get(name.toLowerCase());
      if (!node) continue;
      if (parentName) {
        const parent = byName.get(parentName.toLowerCase());
        if (parent && parent !== node) {
          parent.children.push(node);
          continue;
        }
      }
      roots.push(node);
    }
    payload = roots;
    await api.patch(`/api/${tenantSlug}/settings/profile`, {
      references: { territory_nodes: payload }
    });
    await invalidateAfterApply(tenantSlug, qc);
    return `${preview.rows.length} zona/shahar saqlandi`;
  } else {
    const prefix =
      profileRefKey === "client_format_entries"
        ? "fmt"
        : profileRefKey === "client_type_entries"
          ? "typ"
          : profileRefKey === "client_category_entries"
            ? "cat"
            : "gr";
    payload = preview.rows.map((r) => ({
      id: cell(r, "_id") || newId(prefix),
      name: cell(r, "name"),
      code: cell(r, "code").toUpperCase() || null,
      sort_order: parseSort(cell(r, "sort_order")),
      comment: cell(r, "comment") || null,
      active: true,
      color: null
    }));
  }

  await api.patch(`/api/${tenantSlug}/settings/profile`, {
    references: { [profileRefKey]: await mergeWithExistingReferences(tenantSlug, profileRefKey, payload as Record<string, unknown>[]) }
  });
  await invalidateAfterApply(tenantSlug, qc);
  return `${preview.rows.length} qator saqlandi (asosiy sozlamalar bilan bir xil API)`;
}

export async function applyCompanyForm(
  tenantSlug: string,
  preview: InitialSetupPreviewState,
  qc?: QueryClient
): Promise<string> {
  const row = preview.rows[0];
  if (!row) throw new Error("Kompaniya qatori yo‘q");
  await api.patch(`/api/${tenantSlug}/settings/profile`, {
    name: cell(row, "name"),
    phone: cell(row, "phone") || null,
    address: cell(row, "address") || null
  });
  await invalidateAfterApply(tenantSlug, qc);
  return "Kompaniya saqlandi";
}

export async function applyCatalogRows(
  tenantSlug: string,
  kind: "trade-directions" | "sales-channels",
  preview: InitialSetupPreviewState,
  qc?: QueryClient
): Promise<string> {
  const path = kind === "trade-directions" ? "trade-directions" : "sales-channels";
  const { data } = await api.get<{ data: { id: number; name: string }[] }>(
    `/api/${tenantSlug}/${path}?is_active=true`
  );
  const existing = new Set((data.data ?? []).map((x) => x.name.trim().toLowerCase()));
  let created = 0;
  for (const r of preview.rows) {
    const name = cell(r, "name");
    if (!name || existing.has(name.toLowerCase())) continue;
    await api.post(`/api/${tenantSlug}/${path}`, {
      name,
      code: cell(r, "code") || null,
      comment: cell(r, "comment") || null,
      sort_order: parseSort(cell(r, "sort_order")) ?? 0,
      is_active: true,
      ...(kind === "trade-directions" ? { use_in_order_proposal: true } : {})
    });
    existing.add(name.toLowerCase());
    created++;
  }
  await invalidateAfterApply(tenantSlug, qc);
  return created ? `${created} yangi yozuv qo‘shildi` : "Yangi yozuv yo‘q (takrorlar o‘tkazildi)";
}

export async function applyEntityRows(
  tenantSlug: string,
  entityKind: "warehouses" | "product-categories",
  preview: InitialSetupPreviewState,
  qc?: QueryClient
): Promise<string> {
  if (entityKind === "warehouses") {
    const { data } = await api.get<{ data?: { id: number; name: string; code?: string | null }[] }>(
      `/api/${tenantSlug}/warehouses`
    );
    const existing = new Set((data.data ?? []).map((x) => x.name.trim().toLowerCase()));
    let created = 0;
    for (const r of preview.rows) {
      const name = cell(r, "name");
      if (!name || existing.has(name.toLowerCase())) continue;
      await api.post(`/api/${tenantSlug}/warehouses`, {
        name,
        code: cell(r, "code") || null,
        address: cell(r, "address") || null,
        is_active: true
      });
      existing.add(name.toLowerCase());
      created++;
    }
    await invalidateAfterApply(tenantSlug, qc, ["warehouses"]);
    return created ? `${created} ombor qo‘shildi` : "Yangi ombor yo‘q (takrorlar o‘tkazildi)";
  }

  const { data } = await api.get<{ data?: { id: number; name: string; code?: string | null }[] }>(
    `/api/${tenantSlug}/product-categories`
  );
  const list = data.data ?? [];
  const byName = new Map(list.map((x) => [x.name.trim().toLowerCase(), x]));
  let created = 0;
  // Avval ildizlar, keyin bolalar
  const rows = [...preview.rows].sort((a, b) => {
    const ap = cell(a, "parent") ? 1 : 0;
    const bp = cell(b, "parent") ? 1 : 0;
    return ap - bp;
  });
  for (const r of rows) {
    const name = cell(r, "name");
    if (!name || byName.has(name.toLowerCase())) continue;
    const parentName = cell(r, "parent");
    const parent = parentName ? byName.get(parentName.toLowerCase()) : undefined;
    const row = await api.post<{ id: number; name: string }>(`/api/${tenantSlug}/product-categories`, {
      name,
      code: cell(r, "code") || null,
      parent_id: parent?.id ?? null,
      is_active: true
    });
    byName.set(name.toLowerCase(), { id: row.data.id, name: row.data.name, code: cell(r, "code") || null });
    created++;
  }
  await invalidateAfterApply(tenantSlug, qc, ["product-categories"]);
  return created ? `${created} kategoriya qo‘shildi` : "Yangi kategoriya yo‘q (takrorlar o‘tkazildi)";
}

export async function applyImportStep(
  tenantSlug: string,
  step: InitialSetupStep,
  preview: InitialSetupPreviewState,
  callbacks?: ImportAsyncCallbacks
): Promise<string> {
  if (!step.importApi) throw new Error("Import API yo‘q");
  const blob = buildXlsxBlobFromPreview(preview, getStepTableConfig(step.id));
  return runImportStep(
    tenantSlug,
    step.importApi.importPath,
    step.importApi.importAsyncPath,
    blob,
    preview.fileName,
    callbacks
  );
}

export async function applyStepPreview(
  tenantSlug: string,
  step: InitialSetupStep,
  preview: InitialSetupPreviewState,
  qc?: QueryClient,
  callbacks?: ImportAsyncCallbacks
): Promise<string> {
  const config = getStepTableConfig(step.id);
  if (!config) {
    if (step.importApi) return applyImportStep(tenantSlug, step, preview);
    throw new Error("Qo‘llash usuli aniqlanmadi");
  }

  switch (config.mode) {
    case "company-form":
      return applyCompanyForm(tenantSlug, preview, qc);
    case "profile":
      if (!config.profileRefKey) throw new Error("profileRefKey yo‘q");
      return applyProfileRows(tenantSlug, config.profileRefKey, preview, qc);
    case "catalog-create":
      if (!config.catalogKind) throw new Error("catalogKind yo‘q");
      return applyCatalogRows(tenantSlug, config.catalogKind, preview, qc);
    case "entity-create":
      if (!config.entityKind) throw new Error("entityKind yo‘q");
      return applyEntityRows(tenantSlug, config.entityKind, preview, qc);
    case "import":
      return applyImportStep(tenantSlug, step, preview, callbacks);
    case "readonly-api":
      throw new Error("Bu qadam faqat asosiy sozlamalarda tahrirlanadi");
    default:
      throw new Error("Noma’lum rejim");
  }
}

export type BundleApplyProgress = {
  stepId: string;
  title: string;
  status: "running" | "done" | "skipped" | "failed";
  message?: string;
};

export async function applyBundleInOrder(
  tenantSlug: string,
  bundle: Record<string, InitialSetupPreviewState>,
  stepOrder: InitialSetupStep[],
  qc?: QueryClient,
  doneIds?: ReadonlySet<string>,
  onProgress?: (p: BundleApplyProgress) => void
): Promise<{ ok: string[]; failed: { stepId: string; error: string }[]; succeededIds: string[]; skipped: string[] }> {
  const ok: string[] = [];
  const failed: { stepId: string; error: string }[] = [];
  const succeededIds: string[] = [];
  const skipped: string[] = [];
  const batchDone = new Set(doneIds ?? []);
  const ordered = sortStepsByFlowOrder(stepOrder.filter((s) => bundle[s.id]?.rows.length));

  for (const step of ordered) {
    const preview = bundle[step.id];
    if (!preview?.rows.length) continue;

    const { ok: depsOk, missing } = isStepReady(step, batchDone);
    if (!depsOk) {
      const reason = `Пропущено: сначала выполните — ${missing.join(", ")}`;
      skipped.push(`${step.title}: ${reason}`);
      onProgress?.({ stepId: step.id, title: step.title, status: "skipped", message: reason });
      continue;
    }

    onProgress?.({ stepId: step.id, title: step.title, status: "running" });
    try {
      const msg = await applyStepPreview(tenantSlug, step, preview, qc, {
        onProgress: (message) =>
          onProgress?.({ stepId: step.id, title: step.title, status: "running", message })
      });
      await invalidateAfterApply(tenantSlug, qc, [step.id]);
      batchDone.add(step.id);
      ok.push(`${step.title}: ${msg}`);
      succeededIds.push(step.id);
      onProgress?.({ stepId: step.id, title: step.title, status: "done", message: msg });
    } catch (e) {
      const err = getUserFacingError(e, "Ошибка");
      failed.push({ stepId: step.id, error: `${step.title}: ${err}` });
      onProgress?.({ stepId: step.id, title: step.title, status: "failed", message: err });
    }
  }

  return { ok, failed, succeededIds, skipped };
}
