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

type ShowField = "phone" | "inn" | "address" | "city" | "zone" | "legal_name" | "agent_name";

const SHOW_OPTIONS: { value: ShowField; label: string }[] = [
  { value: "phone", label: "Телефон" },
  { value: "inn", label: "ИНН" },
  { value: "address", label: "Адрес" },
  { value: "city", label: "Город" },
  { value: "zone", label: "Зона" },
  { value: "legal_name", label: "Юр. название" },
  { value: "agent_name", label: "Агент" }
];

const SHOW_STORAGE_KEY = "salec:gp-show:misc";

type MiscDraft = {
  product_category_ref: string;
  credit_limit: string;
  price_type: string;
  tagIds: number[];
};

type ClientsResponse = { data: ClientRow[]; total: number };
type RefOpt = { value: string; label: string };
type TagOpt = { id: number; name: string };

function emptyMisc(): MiscDraft {
  return {
    product_category_ref: "",
    credit_limit: "0",
    price_type: "",
    tagIds: []
  };
}

function fromClient(c: ClientRow): MiscDraft {
  return {
    product_category_ref: c.product_category_ref ?? "",
    credit_limit: String(c.credit_limit ?? "0"),
    price_type: c.price_type ?? "",
    tagIds: (c.tags ?? []).map((t) => t.id).sort((a, b) => a - b)
  };
}

function tagsEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function miscEqual(a: MiscDraft, b: MiscDraft): boolean {
  return (
    a.product_category_ref === b.product_category_ref &&
    a.credit_limit === b.credit_limit &&
    a.price_type === b.price_type &&
    tagsEqual(a.tagIds, b.tagIds)
  );
}

function diffPatch(orig: MiscDraft, draft: MiscDraft): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (draft.product_category_ref !== orig.product_category_ref) {
    patch.product_category_ref = draft.product_category_ref.trim() || null;
  }
  if (draft.credit_limit !== orig.credit_limit) {
    const n = Number.parseFloat(draft.credit_limit.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n) && n >= 0) patch.credit_limit = n;
  }
  if (draft.price_type !== orig.price_type) {
    patch.price_type = draft.price_type.trim() || null;
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
  "h-8 w-full min-w-[7rem] max-w-[11rem] rounded border border-slate-300 bg-white px-1.5 text-[12px] text-slate-800";

export function GroupProcessingMiscWorkspace() {
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
  const [draftByClient, setDraftByClient] = useState<Record<number, MiscDraft>>({});
  const [origByClient, setOrigByClient] = useState<Record<number, MiscDraft>>({});
  const [master, setMaster] = useState<MiscDraft>(() => emptyMisc());
  const [masterApply, setMasterApply] = useState({
    product_category_ref: false,
    credit_limit: false,
    price_type: false,
    tags: false
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
    queryKey: ["clients", "gp-misc", tenantSlug, seedIds.join(","), search],
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

  const refsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "gp-misc"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ product_category_refs?: string[] }>(
        `/api/${tenantSlug}/clients/references`
      );
      return data;
    }
  });

  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenantSlug, "gp-misc"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenantSlug}/price-types?kind=sale`);
      return (data.data ?? []).map((v) => ({ value: v, label: v }));
    }
  });

  const tagsQ = useQuery({
    queryKey: ["client-tags", tenantSlug, "gp-misc"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: TagOpt[] }>(`/api/${tenantSlug}/clients/tags`);
      return data.data ?? [];
    }
  });

  const productOpts = strOpts(refsQ.data?.product_category_refs);
  const priceOpts = priceTypesQ.data ?? [];
  const allTags = tagsQ.data ?? [];
  const tagById = useMemo(() => new Map(allTags.map((t) => [t.id, t.name])), [allTags]);

  const ensureDraft = useCallback(
    (id: number): MiscDraft => draftByClient[id] ?? emptyMisc(),
    [draftByClient]
  );

  const patchRow = (clientId: number, patch: Partial<MiscDraft>) => {
    setDraftByClient((prev) => ({
      ...prev,
      [clientId]: { ...(prev[clientId] ?? emptyMisc()), ...patch }
    }));
  };

  const applyMasterToSelected = () => {
    const targets = selectedIds.size ? selectedIds : new Set(rows.map((r) => r.id));
    const any =
      masterApply.product_category_ref ||
      masterApply.credit_limit ||
      masterApply.price_type ||
      masterApply.tags;
    if (!any) {
      setStatusMsg("Avval umumiy qatorda qaysi maydonlarni qo‘llashni belgilang (✓)");
      return;
    }
    setDraftByClient((prev) => {
      const next = { ...prev };
      for (const id of targets) {
        const cur = { ...(next[id] ?? emptyMisc()) };
        if (masterApply.product_category_ref) {
          cur.product_category_ref = master.product_category_ref;
        }
        if (masterApply.credit_limit) cur.credit_limit = master.credit_limit;
        if (masterApply.price_type) cur.price_type = master.price_type;
        if (masterApply.tags) cur.tagIds = [...master.tagIds];
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
      if (d && o && !miscEqual(d, o)) n += 1;
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
        const tagsChanged = !tagsEqual(draft.tagIds, orig.tagIds);
        if (!patch && !tagsChanged) {
          skipped += 1;
          continue;
        }
        try {
          if (patch) {
            await api.patch(`/api/${tenantSlug}/clients/${id}`, patch);
          }
          if (tagsChanged) {
            const origSet = new Set(orig.tagIds);
            const draftSet = new Set(draft.tagIds);
            const add_tag_ids = draft.tagIds.filter((t) => !origSet.has(t));
            const remove_tag_ids = orig.tagIds.filter((t) => !draftSet.has(t));
            if (add_tag_ids.length || remove_tag_ids.length) {
              await api.patch(`/api/${tenantSlug}/clients/bulk-tags`, {
                client_ids: [id],
                ...(add_tag_ids.length ? { add_tag_ids } : {}),
                ...(remove_tag_ids.length ? { remove_tag_ids } : {})
              });
            }
          }
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
          if (d) next[c.id] = { ...d, tagIds: [...d.tagIds] };
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

  const toggleTagOnDraft = (ids: number[], tagId: number): number[] => {
    const set = new Set(ids);
    if (set.has(tagId)) set.delete(tagId);
    else set.add(tagId);
    return [...set].sort((a, b) => a - b);
  };

  const renderSelects = (
    draft: MiscDraft,
    onChange: (p: Partial<MiscDraft>) => void,
    opts?: { master?: boolean }
  ) => (
    <>
      <td className="border-l border-slate-200 px-2 py-2 align-middle">
        {opts?.master ? (
          <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              className="size-3.5 accent-blue-600"
              checked={masterApply.product_category_ref}
              onChange={(e) =>
                setMasterApply((m) => ({ ...m, product_category_ref: e.target.checked }))
              }
            />
            qo‘llash
          </label>
        ) : null}
        <select
          className={selectClass}
          value={draft.product_category_ref}
          onChange={(e) => onChange({ product_category_ref: e.target.value })}
        >
          <option value="">—</option>
          {productOpts.map((o) => (
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
              checked={masterApply.credit_limit}
              onChange={(e) => setMasterApply((m) => ({ ...m, credit_limit: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <Input
          className="h-8 min-w-[6rem] max-w-[9rem] text-[12px]"
          value={draft.credit_limit}
          onChange={(e) => onChange({ credit_limit: e.target.value })}
        />
      </td>
      <td className="border-l border-slate-100 px-2 py-2 align-middle">
        {opts?.master ? (
          <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              className="size-3.5 accent-blue-600"
              checked={masterApply.price_type}
              onChange={(e) => setMasterApply((m) => ({ ...m, price_type: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <select
          className={selectClass}
          value={draft.price_type}
          onChange={(e) => onChange({ price_type: e.target.value })}
        >
          <option value="">—</option>
          {priceOpts.map((o) => (
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
              checked={masterApply.tags}
              onChange={(e) => setMasterApply((m) => ({ ...m, tags: e.target.checked }))}
            />
            qo‘llash
          </label>
        ) : null}
        <div className="flex max-w-[14rem] flex-wrap gap-1">
          {allTags.length === 0 ? (
            <span className="text-[11px] text-slate-400">Teg yo‘q</span>
          ) : (
            allTags.map((t) => {
              const on = draft.tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    on
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                  onClick={() => onChange({ tagIds: toggleTagOnDraft(draft.tagIds, t.id) })}
                >
                  {t.name}
                </button>
              );
            })
          )}
        </div>
        {draft.tagIds.length > 0 && allTags.length === 0 ? (
          <p className="mt-0.5 text-[10px] text-slate-500">
            {draft.tagIds.map((id) => tagById.get(id) ?? `#${id}`).join(", ")}
          </p>
        ) : null}
      </td>
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">
            Товар · Лимит · Цена · Теги
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
          <table className="w-full min-w-[1200px] border-collapse text-left text-[13px]">
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
                <th className="border-l border-slate-200 px-2 py-2">Mahsulot kat.</th>
                <th className="border-l border-slate-100 px-2 py-2">Kredit limit</th>
                <th className="border-l border-slate-100 px-2 py-2">Narx turi</th>
                <th className="border-l border-slate-100 px-2 py-2">Teglar</th>
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
                {renderSelects(master, (p) => setMaster((m) => ({ ...m, ...p })), { master: true })}
              </tr>
              {rows.map((c, idx) => {
                const draft = ensureDraft(c.id);
                const dirty = origByClient[c.id] ? !miscEqual(draft, origByClient[c.id]!) : false;
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
