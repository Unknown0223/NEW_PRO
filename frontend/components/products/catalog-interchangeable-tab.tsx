"use client";

import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableMultiSelectPanel,
  type SearchableMultiSelectItem
} from "@/components/ui/searchable-multi-select-panel";
import type { InterchangeableGroupRow, ProductRow } from "@/lib/product-types";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  tenantSlug: string | null;
  isAdmin: boolean;
  statusTab: "active" | "inactive";
  search: string;
  pageSize: number;
};

const normPt = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");

function summarize(names: string[], empty: string): string {
  if (names.length === 0) return empty;
  const head = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${head} +ещё ${names.length - 3}` : head;
}

export function CatalogInterchangeableTab({
  tenantSlug,
  isAdmin,
  statusTab,
  search,
  pageSize
}: Props) {
  const qc = useQueryClient();
  const apiPath = "catalog/interchangeable-groups";
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [comment, setComment] = useState("");
  const [active, setActive] = useState(true);
  const [productIds, setProductIds] = useState<Set<number>>(new Set());
  const [productLabels, setProductLabels] = useState<Record<number, string>>({});
  // Tahrirlashda guruhga dastlab kiritilgan mahsulot id'lari — ularning JORIY
  // (jonli) nomlarini tizimdan qayta olish va noaktiv/o'chirilganlarini tushirish uchun.
  const [initialIds, setInitialIds] = useState<number[]>([]);
  const [priceTypesSel, setPriceTypesSel] = useState<Set<string>>(new Set());
  const [pickSearch, setPickSearch] = useState("");
  const [ptSearch, setPtSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const isActiveParam = statusTab === "active";

  const listQ = useQuery({
    queryKey: ["catalog-interchangeable", tenantSlug, statusTab, search, page, pageSize],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        is_active: isActiveParam ? "true" : "false"
      });
      if (search.trim()) params.set("search", search.trim());
      const { data } = await api.get<{ data: InterchangeableGroupRow[]; total: number }>(
        `/api/${tenantSlug}/${apiPath}?${params}`
      );
      return data;
    }
  });

  // Narx turlari — tizimdagi REAL spravochnikdan (Настройки → Тип цены).
  // Faqat FAOL (active) va «sale» turlari; noaktiv qilingani ro'yxatdan ham,
  // belgilanganlardan ham tushib qoladi (backend ham shu qoidaga ko'ra tekshiradi).
  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "interchangeable-modal"],
    enabled: Boolean(tenantSlug) && open,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          price_type_entries?: Array<{
            name: string;
            code: string | null;
            kind: "sale" | "purchase";
            active: boolean;
            sort_order: number | null;
          }>;
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const priceTypeOptions = useMemo(() => {
    const entries = profileQ.data?.references?.price_type_entries ?? [];
    const seen = new Set<string>();
    const out: Array<{ key: string; label: string; sort: number }> = [];
    for (const e of entries) {
      if (e.active === false || e.kind !== "sale") continue;
      const key = (e.code?.trim() || e.name?.trim() || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: e.name?.trim() || key, sort: e.sort_order ?? 1_000_000 });
    }
    return out.sort((a, b) => (a.sort !== b.sort ? a.sort - b.sort : a.label.localeCompare(b.label, "uz")));
  }, [profileQ.data]);

  const ptLabelByKey = useMemo(
    () => new Map(priceTypeOptions.map((o) => [o.key, o.label])),
    [priceTypeOptions]
  );

  const priceTypeItems = useMemo<SearchableMultiSelectItem<string>[]>(
    () => priceTypeOptions.map((o) => ({ id: o.key, title: o.label })),
    [priceTypeOptions]
  );

  // Belgilangan narx turlaridan noaktiv/yo'q bo'lganlarini tushiramiz va kalitni
  // katalogdagi rasmiy ko'rinishga keltiramiz (registr/ajratuvchidan qat'i nazar).
  useEffect(() => {
    if (!profileQ.data) return;
    const canonByNorm = new Map(priceTypeOptions.map((o) => [normPt(o.key), o.key]));
    setPriceTypesSel((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        const canon = canonByNorm.get(normPt(k));
        if (canon) next.add(canon);
      }
      return next;
    });
  }, [profileQ.data, priceTypeOptions]);

  // Mahsulot tanlash — tizimdagi faol mahsulotlar (server qidiruvi bilan).
  const productsQ = useQuery({
    queryKey: ["products-pick", tenantSlug, pickSearch],
    enabled: Boolean(tenantSlug) && open,
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "100", is_active: "true" });
      if (pickSearch.trim()) params.set("search", pickSearch.trim());
      const { data } = await api.get<{ data: ProductRow[]; total: number }>(
        `/api/${tenantSlug}/products?${params.toString()}`
      );
      return data;
    }
  });

  // Tahrir oynasi ochilganda guruhdagi mahsulotlarning JORIY holatini o'qiymiz:
  // nomni yangilaymiz, noaktiv/o'chirilganini tanlovdan tushiramiz.
  const initialIdsKey = useMemo(() => [...initialIds].sort((a, b) => a - b).join(","), [initialIds]);
  const liveNamesQ = useQuery({
    queryKey: ["interchangeable-live-names", tenantSlug, initialIdsKey],
    enabled: Boolean(tenantSlug) && open && initialIds.length > 0,
    staleTime: 0,
    queryFn: async () => {
      const params = new URLSearchParams({ ids: initialIdsKey, limit: "1000" });
      const { data } = await api.get<{ data: ProductRow[] }>(
        `/api/${tenantSlug}/products?${params.toString()}`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!liveNamesQ.data) return;
    const rows = liveNamesQ.data;
    const liveById = new Map(rows.map((p) => [p.id, p]));
    const dropIds = new Set<number>();
    for (const id of initialIds) {
      const live = liveById.get(id);
      if (!live || live.is_active === false) dropIds.add(id);
    }
    setProductLabels((prev) => {
      const next = { ...prev };
      for (const p of rows) {
        if (p?.id != null && p?.name && p.is_active !== false) next[p.id] = p.name;
      }
      for (const id of dropIds) delete next[id];
      return next;
    });
    if (dropIds.size > 0) {
      setProductIds((prev) => {
        const n = new Set(prev);
        for (const id of dropIds) n.delete(id);
        return n;
      });
    }
  }, [liveNamesQ.data, initialIds]);

  useEffect(() => {
    setPage(1);
  }, [search, statusTab, pageSize]);

  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetForm() {
    setEditId(null);
    setName("");
    setCode("");
    setSortOrder("");
    setComment("");
    setActive(true);
    setProductIds(new Set());
    setProductLabels({});
    setInitialIds([]);
    setPriceTypesSel(new Set());
    setPickSearch("");
    setPtSearch("");
    setMsg(null);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(r: InterchangeableGroupRow) {
    resetForm();
    setEditId(r.id);
    setName(r.name);
    setCode(r.code ?? "");
    setSortOrder(r.sort_order != null ? String(r.sort_order) : "");
    setComment(r.comment ?? "");
    setActive(r.is_active);
    setProductIds(new Set(r.products.map((p) => p.id)));
    setProductLabels(Object.fromEntries(r.products.map((p) => [p.id, p.name])));
    setInitialIds(r.products.map((p) => p.id));
    setPriceTypesSel(new Set(r.price_types));
    setOpen(true);
  }

  // Mahsulot dropdown elementlari: tanlanganlar tepada, so'ng qidiruv natijalari.
  const productItems = useMemo<SearchableMultiSelectItem<number>[]>(() => {
    const map = new Map<number, SearchableMultiSelectItem<number>>();
    for (const id of productIds) {
      map.set(id, { id, title: productLabels[id] ?? `#${id}` });
    }
    for (const p of productsQ.data?.data ?? []) {
      map.set(p.id, { id: p.id, title: p.name, subtitle: p.sku });
    }
    return [...map.values()];
  }, [productIds, productLabels, productsQ.data]);

  // Tanlanganlar nomini yangilab borish (yangi qo'shilganlar uchun).
  useEffect(() => {
    const list = productsQ.data?.data;
    if (!list || list.length === 0) return;
    setProductLabels((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of list) {
        if (productIds.has(p.id) && next[p.id] !== p.name) {
          next[p.id] = p.name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [productsQ.data, productIds]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("no");
      const body = {
        name: name.trim(),
        code: code.trim() || null,
        sort_order: sortOrder.trim() === "" ? null : Number.parseInt(sortOrder, 10),
        comment: comment.trim() || null,
        is_active: active,
        product_ids: [...productIds],
        price_types: [...priceTypesSel]
      };
      if (!body.name) throw new Error("name");
      if (editId != null) {
        await api.put(`/api/${tenantSlug}/${apiPath}/${editId}`, body);
      } else {
        await api.post(`/api/${tenantSlug}/${apiPath}`, body);
      }
    },
    onSuccess: async () => {
      setMsg(null);
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["catalog-interchangeable", tenantSlug] });
    },
    onError: (e: unknown) => setMsg(getUserFacingError(e, "Saqlashda xato yoki ruxsat yo‘q."))
  });

  const productSummary = () =>
    summarize(
      [...productIds].map((id) => productLabels[id] ?? `#${id}`),
      "Выберите продукты"
    );
  const priceTypeSummary = () =>
    summarize(
      [...priceTypesSel].map((k) => ptLabelByKey.get(k) ?? k),
      "Выберите типы цены"
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Группа взаимозаменяемых товаров</p>
        {isAdmin ? (
          <Button type="button" size="sm" onClick={openCreate}>
            Добавить
          </Button>
        ) : null}
      </div>

      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="app-table-thead text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Название</th>
              <th className="px-3 py-2 font-medium">Код</th>
              <th className="px-3 py-2 font-medium">Сорт.</th>
              <th className="px-3 py-2 font-medium">Продукты</th>
              <th className="px-3 py-2 font-medium">Тип цены</th>
              <th className="px-3 py-2 font-medium">Комментарий</th>
              <th className="px-3 py-2 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Пусто
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.code ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.sort_order != null ? formatGroupedInteger(r.sort_order) : "—"}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-muted-foreground">
                    <span className="mb-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                      {formatGroupedInteger(r.products.length)} шт
                    </span>
                    <div className="mt-0.5">
                      {r.products.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          className="mb-0.5 mr-1 inline-block rounded bg-muted px-1 py-0.5"
                        >
                          {p.name}
                        </span>
                      ))}
                      {r.products.length > 3 ? (
                        <span className="text-muted-foreground">
                          +{formatGroupedInteger(r.products.length - 3)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="max-w-[180px] px-3 py-2 text-xs text-muted-foreground">
                    {r.price_types.slice(0, 3).join(", ")}
                    {r.price_types.length > 3 ? ` +${r.price_types.length - 3}` : ""}
                  </td>
                  <td className="max-w-[160px] px-3 py-2 text-xs text-muted-foreground">
                    {r.comment ? <span title={r.comment}>{r.comment}</span> : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isAdmin ? (
                      <TableRowActionGroup className="justify-end" ariaLabel="Guruh">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          title="Tahrirlash"
                          aria-label="Tahrirlash"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                      </TableRowActionGroup>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total
            ? `Показано ${formatGroupedInteger((page - 1) * pageSize + 1)}–${formatGroupedInteger(Math.min(page * pageSize, total))} / ${formatGroupedInteger(total)}`
            : ""}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </Button>
          <span className="px-2 py-1">
            {formatGroupedInteger(page)} / {formatGroupedInteger(totalPages)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать" : "Новая группа"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Название</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <div className="flex justify-between">
                <Label>Код</Label>
                <span className="text-xs text-muted-foreground">{code.length} / 20</span>
              </div>
              <Input value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <Label>Сортировка</Label>
              <Input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value.replace(/[^0-9-]/g, ""))}
                inputMode="numeric"
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Продукты</Label>
                <span className="text-xs text-muted-foreground">
                  Выбрано: {formatGroupedInteger(productIds.size)}
                </span>
              </div>
              <SearchableMultiSelectPanel<number>
                label="Продукты"
                items={productItems}
                selected={productIds}
                onSelectedChange={setProductIds}
                searchable
                search={pickSearch}
                onSearchChange={setPickSearch}
                loading={productsQ.isFetching}
                searchPlaceholder="Поиск по названию / SKU…"
                emptyMessage={pickSearch.trim() ? "Ничего не найдено" : "Начните вводить для поиска"}
                selectAllLabel="Выбрать все на экране"
                clearVisibleLabel="Снять на экране"
                triggerPlaceholder="Выберите продукты"
                hideOuterLabel
                formatTriggerSummary={productSummary}
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Тип цены</Label>
                <span className="text-xs text-muted-foreground">
                  Выбрано: {formatGroupedInteger(priceTypesSel.size)}
                </span>
              </div>
              <SearchableMultiSelectPanel<string>
                label="Тип цены"
                items={priceTypeItems}
                selected={priceTypesSel}
                onSelectedChange={setPriceTypesSel}
                searchable={priceTypeItems.length > 8}
                search={ptSearch}
                onSearchChange={setPtSearch}
                filterItemsBySearch
                loading={profileQ.isLoading}
                searchPlaceholder="Поиск типа цены…"
                emptyMessage={profileQ.isLoading ? "Загрузка…" : "Нет активных типов цены"}
                selectAllLabel="Выбрать все"
                clearVisibleLabel="Снять"
                triggerPlaceholder="Выберите типы цены"
                hideOuterLabel
                formatTriggerSummary={priceTypeSummary}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Комментарий</Label>
              <textarea
                className="min-h-[56px] rounded-md border bg-background px-2 py-1 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>Активный</span>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            </label>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !isAdmin}>
              {saveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {editId ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
