"use client";

import { GROUP_PROCESSING_IDS_STORAGE_KEY } from "@/components/clients/group-processing/group-processing-actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ShowField = "phone" | "inn" | "address" | "city" | "zone" | "agent_name";

const SHOW_OPTIONS: { value: ShowField; label: string }[] = [
  { value: "phone", label: "Телефон" },
  { value: "inn", label: "ИНН" },
  { value: "address", label: "Адрес" },
  { value: "city", label: "Город" },
  { value: "zone", label: "Зона" },
  { value: "agent_name", label: "Агент" }
];

const SHOW_STORAGE_KEY = "salec:gp-show:ops";

type OpsDraft = {
  warehouse_id: string;
  cash_desk_id: string;
};

type ClientsResponse = { data: ClientRow[]; total: number };

function emptyOps(): OpsDraft {
  return { warehouse_id: "", cash_desk_id: "" };
}

function fromClient(c: ClientRow): OpsDraft {
  return {
    warehouse_id: c.warehouse_id != null ? String(c.warehouse_id) : "",
    cash_desk_id: c.cash_desk_id != null ? String(c.cash_desk_id) : ""
  };
}

function opsEqual(a: OpsDraft, b: OpsDraft): boolean {
  return a.warehouse_id === b.warehouse_id && a.cash_desk_id === b.cash_desk_id;
}

function diffPatch(orig: OpsDraft, draft: OpsDraft): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (draft.warehouse_id !== orig.warehouse_id) {
    const n = Number.parseInt(draft.warehouse_id, 10);
    patch.warehouse_id = Number.isFinite(n) && n > 0 ? n : null;
  }
  if (draft.cash_desk_id !== orig.cash_desk_id) {
    const n = Number.parseInt(draft.cash_desk_id, 10);
    patch.cash_desk_id = Number.isFinite(n) && n > 0 ? n : null;
  }
  return Object.keys(patch).length ? patch : null;
}

function parseIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[, ]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ].slice(0, 500);
}

function loadStoredIds(): number[] {
  try {
    const raw = sessionStorage.getItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 500);
  } catch {
    return [];
  }
}

function showValue(c: ClientRow, field: ShowField): string {
  const v = c[field];
  if (v == null || String(v).trim() === "") return "—";
  return String(v);
}

const selectClass =
  "h-8 w-full min-w-[8rem] max-w-[12rem] rounded border border-slate-300 bg-white px-1.5 text-[12px] text-slate-800";

export function GroupProcessingOpsWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const seedIds = useMemo(() => {
    const fromQ = parseIds(searchParams.get("ids"));
    if (fromQ.length) return fromQ;
    return loadStoredIds();
  }, [searchParams]);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(seedIds));
  const [draftByClient, setDraftByClient] = useState<Record<number, OpsDraft>>({});
  const [origByClient, setOrigByClient] = useState<Record<number, OpsDraft>>({});
  const [master, setMaster] = useState<OpsDraft>(() => emptyOps());
  const [masterApply, setMasterApply] = useState({ warehouse_id: false, cash_desk_id: false });
  const [showField, setShowField] = useState<ShowField>(() => {
    try {
      const v = localStorage.getItem(SHOW_STORAGE_KEY) as ShowField | null;
      if (v && SHOW_OPTIONS.some((o) => o.value === v)) return v;
    } catch {
      /* ignore */
    }
    return "phone";
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const clientsQ = useQuery({
    queryKey: ["clients", "gp-ops", tenantSlug, seedIds.join(","), search],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      if (seedIds.length > 0) {
        const params = new URLSearchParams({
          page: "1",
          limit: String(Math.min(500, seedIds.length)),
          client_ids: seedIds.join(",")
        });
        if (search.trim()) params.set("search", search.trim());
        const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
        const byId = new Map(data.data.map((c) => [c.id, c]));
        const ordered = seedIds.map((id) => byId.get(id)).filter(Boolean) as ClientRow[];
        return { data: ordered, total: ordered.length };
      }
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
      return { data: data.data, total: data.total };
    }
  });

  const rows = clientsQ.data?.data ?? [];

  useEffect(() => {
    if (!rows.length) return;
    setDraftByClient((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of rows) {
        if (!next[c.id]) {
          next[c.id] = fromClient(c);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setOrigByClient((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of rows) {
        if (!next[c.id]) {
          next[c.id] = fromClient(c);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_STORAGE_KEY, showField);
    } catch {
      /* ignore */
    }
  }, [showField]);

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "gp-ops"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string }> }>(
        `/api/${tenantSlug}/warehouses/table?is_active=true&page=1&limit=200`
      );
      return data.data ?? [];
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "gp-ops"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string }> }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return data.data ?? [];
    }
  });

  const warehouseOpts = useMemo(
    () => (warehousesQ.data ?? []).map((w) => ({ value: String(w.id), label: w.name })),
    [warehousesQ.data]
  );
  const cashOpts = useMemo(
    () => (cashDesksQ.data ?? []).map((w) => ({ value: String(w.id), label: w.name })),
    [cashDesksQ.data]
  );

  const ensureDraft = useCallback(
    (id: number): OpsDraft => draftByClient[id] ?? emptyOps(),
    [draftByClient]
  );

  const patchRow = (clientId: number, patch: Partial<OpsDraft>) => {
    setDraftByClient((prev) => ({
      ...prev,
      [clientId]: { ...(prev[clientId] ?? emptyOps()), ...patch }
    }));
  };

  const applyMasterToSelected = () => {
    const targets = selectedIds.size ? selectedIds : new Set(rows.map((r) => r.id));
    if (!masterApply.warehouse_id && !masterApply.cash_desk_id) {
      setStatusMsg("Сначала отметьте в общей строке, какие поля применять (✓)");
      return;
    }
    setDraftByClient((prev) => {
      const next = { ...prev };
      for (const id of targets) {
        const cur = { ...(next[id] ?? emptyOps()) };
        if (masterApply.warehouse_id) cur.warehouse_id = master.warehouse_id;
        if (masterApply.cash_desk_id) cur.cash_desk_id = master.cash_desk_id;
        next[id] = cur;
      }
      return next;
    });
    setStatusMsg(`Общие значения применены к ${targets.size} клиентам (нужно сохранить)`);
  };

  const toggleSelectAll = (on: boolean) => {
    if (on) setSelectedIds(new Set(rows.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const c of rows) {
      const d = draftByClient[c.id];
      const o = origByClient[c.id];
      if (d && o && !opsEqual(d, o)) n += 1;
    }
    return n;
  }, [rows, draftByClient, origByClient]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("No tenant");
      const targets = selectedIds.size ? [...selectedIds] : rows.map((r) => r.id);
      let ok = 0;
      let skipped = 0;
      const failed: string[] = [];
      for (const id of targets) {
        const draft = draftByClient[id];
        const orig = origByClient[id];
        if (!draft || !orig) {
          skipped += 1;
          continue;
        }
        const patch = diffPatch(orig, draft);
        if (!patch) {
          skipped += 1;
          continue;
        }
        try {
          await api.patch(`/api/${tenantSlug}/clients/${id}`, patch);
          ok += 1;
        } catch (e) {
          failed.push(`#${id}: ${getUserFacingError(e, "ошибка")}`);
        }
      }
      return { ok, skipped, failed };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
      if (res.ok > 0 && res.failed.length === 0) {
        router.push("/clients");
        return;
      }
      setOrigByClient((prev) => {
        const next = { ...prev };
        for (const c of rows) {
          const d = draftByClient[c.id];
          if (d) next[c.id] = { ...d };
        }
        return next;
      });
      setStatusMsg(
        res.failed.length
          ? `Сохранено: ${res.ok}. Ошибки: ${res.failed.slice(0, 3).join("; ")}`
          : `Сохранено: ${res.ok} · без изменений: ${res.skipped}`
      );
    },
    onError: (e) => setStatusMsg(getUserFacingError(e, "Ошибка сохранения"))
  });

  const withCurrent = (opts: { value: string; label: string }[], current: string) => {
    if (!current.trim() || opts.some((o) => o.value === current)) return opts;
    return [{ value: current, label: `#${current}` }, ...opts];
  };

  const renderSelects = (
    draft: OpsDraft,
    onChange: (p: Partial<OpsDraft>) => void,
    opts?: { master?: boolean }
  ) => {
    const wh = withCurrent(warehouseOpts, draft.warehouse_id);
    const cash = withCurrent(cashOpts, draft.cash_desk_id);
    return (
      <>
        <td className="border-l border-slate-200 px-2 py-2 align-middle">
          {opts?.master ? (
            <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
              <input
                type="checkbox"
                className="size-3.5 accent-blue-600"
                checked={masterApply.warehouse_id}
                onChange={(e) => setMasterApply((m) => ({ ...m, warehouse_id: e.target.checked }))}
              />
              применить
            </label>
          ) : null}
          <select
            className={selectClass}
            value={draft.warehouse_id}
            onChange={(e) => onChange({ warehouse_id: e.target.value })}
          >
            <option value="">—</option>
            {wh.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td className="border-l border-slate-100 px-2 py-2 align-middle">
          {opts?.master ? (
            <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
              <input
                type="checkbox"
                className="size-3.5 accent-blue-600"
                checked={masterApply.cash_desk_id}
                onChange={(e) => setMasterApply((m) => ({ ...m, cash_desk_id: e.target.checked }))}
              />
              применить
            </label>
          ) : null}
          <select
            className={selectClass}
            value={draft.cash_desk_id}
            onChange={(e) => onChange({ cash_desk_id: e.target.value })}
          >
            <option value="">—</option>
            {cash.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
      </>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">Склад · Касса</h1>
          <p className="text-sm text-muted-foreground">
            Клиентов: <b>{rows.length}</b>
            {selectedIds.size ? (
              <>
                {" "}
                · выбрано: <b>{selectedIds.size}</b>
              </>
            ) : null}
            {dirtyCount > 0 ? (
              <>
                {" "}
                · изменено: <b>{dirtyCount}</b>
              </>
            ) : null}
          </p>
          {statusMsg ? <p className="mt-1 text-sm text-emerald-700">{statusMsg}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/clients" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Вернуться обратно
          </Link>
          <Button
            type="button"
            size="sm"
            disabled={saveMut.isPending || !rows.length || dirtyCount === 0}
            onClick={() => saveMut.mutate()}
          >
            <Save className="mr-1.5 size-3.5" />
            {saveMut.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Поиск</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон…"
            className="h-9"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Показать</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={showField}
            onChange={(e) => setShowField(e.target.value as ShowField)}
          >
            {SHOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => toggleSelectAll(true)}>
          Выбрать всех
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => toggleSelectAll(false)}>
          Снять выбор
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {clientsQ.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>
        ) : !rows.length ? (
          <div className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>Нет клиентов. Сначала выберите клиентов в списке.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/clients")}>
              К списку клиентов
            </Button>
          </div>
        ) : (
          <table className="w-full min-w-[900px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-blue-600"
                    checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="w-16 px-2 py-2">ID</th>
                <th className="min-w-[10rem] px-2 py-2">Клиент</th>
                <th className="min-w-[8rem] px-2 py-2">Показать</th>
                <th className="border-l border-slate-200 px-2 py-2">Склад</th>
                <th className="border-l border-slate-100 px-2 py-2">Касса</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300 bg-emerald-50/60">
                <td className="px-2 py-2" colSpan={4}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-emerald-800">
                      Общая строка (для выбранных)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      onClick={applyMasterToSelected}
                    >
                      Применить отмеченные поля
                    </Button>
                  </div>
                </td>
                {renderSelects(master, (p) => setMaster((m) => ({ ...m, ...p })), { master: true })}
              </tr>
              {rows.map((c, idx) => {
                const draft = ensureDraft(c.id);
                const dirty = origByClient[c.id] ? !opsEqual(draft, origByClient[c.id]!) : false;
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-slate-100",
                      idx % 2 === 1 ? "bg-slate-50/80" : "bg-white",
                      selectedIds.has(c.id) && "bg-amber-50/70",
                      dirty && "ring-1 ring-inset ring-amber-300/80"
                    )}
                  >
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-blue-600"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleRow(c.id)}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle font-mono text-[12px] text-slate-600">
                      {c.id}
                    </td>
                    <td className="px-2 py-2 align-middle font-medium text-slate-800">{c.name}</td>
                    <td className="px-2 py-2 align-middle text-slate-600">
                      {showValue(c, showField)}
                    </td>
                    {renderSelects(draft, (p) => patchRow(c.id, p))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
