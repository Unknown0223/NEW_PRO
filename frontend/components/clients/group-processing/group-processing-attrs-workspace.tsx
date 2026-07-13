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

type ShowField = "phone" | "inn" | "address" | "city" | "zone" | "client_code" | "legal_name" | "agent_name";

const SHOW_OPTIONS: { value: ShowField; label: string }[] = [
  { value: "phone", label: "Телефон" },
  { value: "inn", label: "ИНН" },
  { value: "address", label: "Адрес" },
  { value: "city", label: "Город" },
  { value: "zone", label: "Зона" },
  { value: "client_code", label: "Код" },
  { value: "legal_name", label: "Юр. название" },
  { value: "agent_name", label: "Агент" }
];

const SHOW_STORAGE_KEY = "salec:gp-show:attrs";

type AttrDraft = {
  is_active: boolean;
  category: string;
  client_type_code: string;
  client_format: string;
  sales_channel: string;
};

type ClientsResponse = {
  data: ClientRow[];
  total: number;
  page: number;
  limit: number;
};

type RefOpt = { value: string; label: string };

function emptyAttr(): AttrDraft {
  return {
    is_active: true,
    category: "",
    client_type_code: "",
    client_format: "",
    sales_channel: ""
  };
}

function fromClient(c: ClientRow): AttrDraft {
  return {
    is_active: c.is_active !== false,
    category: c.category ?? "",
    client_type_code: c.client_type_code ?? "",
    client_format: c.client_format ?? "",
    sales_channel: c.sales_channel ?? ""
  };
}

function attrsEqual(a: AttrDraft, b: AttrDraft): boolean {
  return (
    a.is_active === b.is_active &&
    a.category === b.category &&
    a.client_type_code === b.client_type_code &&
    a.client_format === b.client_format &&
    a.sales_channel === b.sales_channel
  );
}

/** Faqat o‘zgargan maydonlar — qolganlari tegilmaydi. */
function diffPatch(orig: AttrDraft, draft: AttrDraft): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (draft.is_active !== orig.is_active) patch.is_active = draft.is_active;
  if (draft.category !== orig.category) patch.category = draft.category.trim() || null;
  if (draft.client_type_code !== orig.client_type_code) {
    patch.client_type_code = draft.client_type_code.trim() || null;
  }
  if (draft.client_format !== orig.client_format) {
    patch.client_format = draft.client_format.trim() || null;
  }
  if (draft.sales_channel !== orig.sales_channel) {
    patch.sales_channel = draft.sales_channel.trim() || null;
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

function strOpts(values: string[] | undefined): RefOpt[] {
  return (values ?? []).map((v) => ({ value: v, label: v }));
}

const selectClass =
  "h-8 w-full min-w-[8rem] max-w-[12rem] rounded border border-slate-300 bg-white px-1.5 text-[12px] text-slate-800";

export function GroupProcessingAttrsWorkspace() {
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
  const [draftByClient, setDraftByClient] = useState<Record<number, AttrDraft>>({});
  const [origByClient, setOrigByClient] = useState<Record<number, AttrDraft>>({});
  const [master, setMaster] = useState<AttrDraft>(() => emptyAttr());
  /** Master maydonlaridan qaysilari «hammasiga» qo‘llanadi */
  const [masterApply, setMasterApply] = useState({
    is_active: false,
    category: false,
    client_type_code: false,
    client_format: false,
    sales_channel: false
  });
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
    queryKey: ["clients", "gp-attrs", tenantSlug, seedIds.join(","), search],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      if (seedIds.length > 0) {
        const params = new URLSearchParams({
          page: "1",
          limit: String(Math.min(500, seedIds.length))
        });
        params.set("client_ids", seedIds.join(","));
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
      const nextDraft = { ...prev };
      let draftChanged = false;
      for (const c of rows) {
        if (!nextDraft[c.id]) {
          nextDraft[c.id] = fromClient(c);
          draftChanged = true;
        }
      }
      return draftChanged ? nextDraft : prev;
    });
    setOrigByClient((prev) => {
      const nextOrig = { ...prev };
      let origChanged = false;
      for (const c of rows) {
        if (!nextOrig[c.id]) {
          nextOrig[c.id] = fromClient(c);
          origChanged = true;
        }
      }
      return origChanged ? nextOrig : prev;
    });
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_STORAGE_KEY, showField);
    } catch {
      /* ignore */
    }
  }, [showField]);

  const refsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "gp-attrs"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{
        categories?: string[];
        client_type_codes?: string[];
        client_formats?: string[];
        sales_channels?: string[];
        category_options?: RefOpt[];
        client_type_options?: RefOpt[];
        client_format_options?: RefOpt[];
        sales_channel_options?: RefOpt[];
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const categoryOpts = refsQ.data?.category_options?.length
    ? refsQ.data.category_options
    : strOpts(refsQ.data?.categories);
  const typeOpts = refsQ.data?.client_type_options?.length
    ? refsQ.data.client_type_options
    : strOpts(refsQ.data?.client_type_codes);
  const formatOpts = refsQ.data?.client_format_options?.length
    ? refsQ.data.client_format_options
    : strOpts(refsQ.data?.client_formats);
  const channelOpts = refsQ.data?.sales_channel_options?.length
    ? refsQ.data.sales_channel_options
    : strOpts(refsQ.data?.sales_channels);

  const ensureDraft = useCallback(
    (id: number): AttrDraft => draftByClient[id] ?? emptyAttr(),
    [draftByClient]
  );

  const patchRow = (clientId: number, patch: Partial<AttrDraft>) => {
    setDraftByClient((prev) => ({
      ...prev,
      [clientId]: { ...(prev[clientId] ?? emptyAttr()), ...patch }
    }));
  };

  const applyMasterToSelected = () => {
    const targets = selectedIds.size ? selectedIds : new Set(rows.map((r) => r.id));
    const any =
      masterApply.is_active ||
      masterApply.category ||
      masterApply.client_type_code ||
      masterApply.client_format ||
      masterApply.sales_channel;
    if (!any) {
      setStatusMsg("Avval umumiy qatorda qaysi maydonlarni qo‘llashni belgilang (✓)");
      return;
    }
    setDraftByClient((prev) => {
      const next = { ...prev };
      for (const id of targets) {
        const cur = { ...(next[id] ?? emptyAttr()) };
        if (masterApply.is_active) cur.is_active = master.is_active;
        if (masterApply.category) cur.category = master.category;
        if (masterApply.client_type_code) cur.client_type_code = master.client_type_code;
        if (masterApply.client_format) cur.client_format = master.client_format;
        if (masterApply.sales_channel) cur.sales_channel = master.sales_channel;
        next[id] = cur;
      }
      return next;
    });
    setStatusMsg(`${targets.size} ta klientga umumiy qiymatlar qo‘llandi (saqlash kerak)`);
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
      if (d && o && !attrsEqual(d, o)) n += 1;
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
          failed.push(`#${id}: ${getUserFacingError(e, "xato")}`);
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
          ? `Saqlandi: ${res.ok}. Xato: ${res.failed.slice(0, 3).join("; ")}`
          : `Saqlandi: ${res.ok} ta · o‘zgarmagan: ${res.skipped}`
      );
    },
    onError: (e) => setStatusMsg(getUserFacingError(e, "Saqlashda xato"))
  });

  const renderAttrSelects = (
    draft: AttrDraft,
    onChange: (p: Partial<AttrDraft>) => void,
    opts?: { master?: boolean }
  ) => (
    <>
      <td className="border-l border-slate-200 px-2 py-2 align-middle">
        {opts?.master ? (
          <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              className="size-3.5 accent-blue-600"
              checked={masterApply.is_active}
              onChange={(e) => setMasterApply((m) => ({ ...m, is_active: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <select
          className={selectClass}
          value={draft.is_active ? "1" : "0"}
          onChange={(e) => onChange({ is_active: e.target.value === "1" })}
        >
          <option value="1">Актив</option>
          <option value="0">Неактив</option>
        </select>
      </td>
      <td className="border-l border-slate-100 px-2 py-2 align-middle">
        {opts?.master ? (
          <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              className="size-3.5 accent-blue-600"
              checked={masterApply.category}
              onChange={(e) => setMasterApply((m) => ({ ...m, category: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <select
          className={selectClass}
          value={draft.category}
          onChange={(e) => onChange({ category: e.target.value })}
        >
          <option value="">—</option>
          {categoryOpts.map((o) => (
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
              checked={masterApply.client_type_code}
              onChange={(e) => setMasterApply((m) => ({ ...m, client_type_code: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <select
          className={selectClass}
          value={draft.client_type_code}
          onChange={(e) => onChange({ client_type_code: e.target.value })}
        >
          <option value="">—</option>
          {typeOpts.map((o) => (
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
              checked={masterApply.client_format}
              onChange={(e) => setMasterApply((m) => ({ ...m, client_format: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <select
          className={selectClass}
          value={draft.client_format}
          onChange={(e) => onChange({ client_format: e.target.value })}
        >
          <option value="">—</option>
          {formatOpts.map((o) => (
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
              checked={masterApply.sales_channel}
              onChange={(e) => setMasterApply((m) => ({ ...m, sales_channel: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <select
          className={selectClass}
          value={draft.sales_channel}
          onChange={(e) => onChange({ sales_channel: e.target.value })}
        >
          <option value="">—</option>
          {channelOpts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">
            Активность · Категория · Тип/формат · Канал продаж
          </h1>
          <p className="text-sm text-muted-foreground">
            Количество клиентов: <b>{rows.length}</b>
            {selectedIds.size ? (
              <>
                {" "}
                · выбрано: <b>{selectedIds.size}</b>
              </>
            ) : null}
            {dirtyCount > 0 ? (
              <>
                {" "}
                · o‘zgargan: <b>{dirtyCount}</b>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Mavjud bog‘lanishlar jadvalda. Qatorda o‘zgartirsangiz — faqat shu klient; umumiy qatordan
            belgilangan maydonlar — tanlanganlarga.
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
          <label className="mb-1 block text-xs text-muted-foreground">Показать (3-я колонка)</label>
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
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
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
                <th className="min-w-[8rem] px-2 py-2">
                  Показать
                  <div className="mt-0.5 text-[10px] font-normal normal-case text-slate-400">
                    {SHOW_OPTIONS.find((o) => o.value === showField)?.label}
                  </div>
                </th>
                <th className="border-l border-slate-200 px-2 py-2">Активность</th>
                <th className="border-l border-slate-100 px-2 py-2">Категория</th>
                <th className="border-l border-slate-100 px-2 py-2">Тип</th>
                <th className="border-l border-slate-100 px-2 py-2">Формат</th>
                <th className="border-l border-slate-100 px-2 py-2">Савдо канали</th>
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
                      Belgilangan maydonlarni qo‘llash
                    </Button>
                  </div>
                </td>
                {renderAttrSelects(master, (p) => setMaster((m) => ({ ...m, ...p })), { master: true })}
              </tr>
              {rows.map((c, idx) => {
                const draft = ensureDraft(c.id);
                const dirty = origByClient[c.id] ? !attrsEqual(draft, origByClient[c.id]!) : false;
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
                    <td className="px-2 py-2 align-middle font-mono text-[12px] text-slate-600">{c.id}</td>
                    <td className="px-2 py-2 align-middle font-medium text-slate-800">{c.name}</td>
                    <td className="px-2 py-2 align-middle text-slate-600">{showValue(c, showField)}</td>
                    {renderAttrSelects(draft, (p) => patchRow(c.id, p))}
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
