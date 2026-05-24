"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { CalendarDays, Download, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ProductRow = { id: number; name: string; sku: string };
type CategoryRow = { id: number; name: string };
type AgentPick = { id: number; fio: string; code: string | null };
type PriceTypeRow = string;
type RefResponse = {
  region_options?: { value: string; label: string }[];
  zones?: string[];
  city_options?: { value: string; label: string }[];
};

type ProductViewRow = {
  stock_date: string;
  client_name: string;
  territory: string;
  agent_name: string | null;
  category_name: string | null;
  product_name: string;
  sku: string;
  quantity: string;
  sold_quantity: string;
  volume: string | null;
  amount: string;
  comment: string | null;
};

type CategoryViewRow = {
  stock_date: string;
  category_name: string;
  quantity: string;
  sold_quantity: string;
  amount: string;
  coverage_clients: number;
};

type ListResponse = {
  view: "products" | "categories";
  page: number;
  limit: number;
  total: number;
  kpi: { base_presence_rate: string; sales_coefficient: string };
  data: ProductViewRow[] | CategoryViewRow[];
};
type UploadResponse = { applied: number; errors: string[] };

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("ru-RU");
  } catch {
    return s;
  }
}

export function RetailStockWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProductViewRow[] | CategoryViewRow[]>([]);
  const [view, setView] = useState<"products" | "categories">("products");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState({ base_presence_rate: "0.00", sales_coefficient: "0.0000" });

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [agentId, setAgentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [priceType, setPriceType] = useState("");
  const [territory1, setTerritory1] = useState("");
  const [territory2, setTerritory2] = useState("");
  const [territory3, setTerritory3] = useState("");

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [agents, setAgents] = useState<AgentPick[]>([]);
  const [priceTypes, setPriceTypes] = useState<PriceTypeRow[]>([]);
  const [regions, setRegions] = useState<Array<{ value: string; label: string }>>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [cities, setCities] = useState<Array<{ value: string; label: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load(nextPage = page) {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({
        page: String(nextPage),
        limit: String(limit),
        view
      });
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      if (agentId.trim()) p.set("agent_id", agentId.trim());
      if (categoryId) p.set("category_id", categoryId);
      if (productId) p.set("product_id", productId);
      if (priceType.trim()) p.set("price_type", priceType.trim());
      if (territory1) p.set("territory_1", territory1);
      if (territory2) p.set("territory_2", territory2);
      if (territory3) p.set("territory_3", territory3);
      const { data } = await api.get<ListResponse>(`/api/${tenantSlug}/retail-stock?${p.toString()}`);
      setRows(data.data ?? []);
      setPage(data.page ?? nextPage);
      setTotal(data.total ?? 0);
      setKpi(data.kpi ?? { base_presence_rate: "0.00", sales_coefficient: "0.0000" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!tenantSlug) return;
    void (async () => {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        api.get<{ data: ProductRow[] }>(`/api/${tenantSlug}/products?page=1&limit=500&is_active=true`),
        api.get<{ data: CategoryRow[] }>(`/api/${tenantSlug}/product-categories`),
        api.get<RefResponse>(`/api/${tenantSlug}/clients/references`),
        api.get<{ data: AgentPick[] }>(`/api/${tenantSlug}/agents?is_active=true`),
        api.get<{ data: PriceTypeRow[] }>(`/api/${tenantSlug}/price-types?kind=sale`)
      ]);
      setProducts(r1.data.data ?? []);
      setCategories(r2.data.data ?? []);
      setRegions(r3.data.region_options ?? []);
      setZones(r3.data.zones ?? []);
      setCities(r3.data.city_options ?? []);
      setAgents(r4.data.data ?? []);
      setPriceTypes(r5.data.data ?? []);
    })();
  }, [tenantSlug]);

  useEffect(() => {
    if (tenantSlug) void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, view, limit]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  async function downloadTemplate() {
    if (!tenantSlug) return;
    const res = await api.get(`/api/${tenantSlug}/retail-stock/template`, { responseType: "arraybuffer" });
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "retail-stock-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadFile(file: File) {
    if (!tenantSlug) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<UploadResponse>(`/api/${tenantSlug}/retail-stock/upload`, fd);
      setUploadResult(data);
      await load(1);
    } finally {
      setUploading(false);
    }
  }

  async function exportExcel() {
    if (!tenantSlug) return;
    const p = new URLSearchParams({ view });
    if (dateFrom) p.set("date_from", dateFrom);
    if (dateTo) p.set("date_to", dateTo);
    if (agentId.trim()) p.set("agent_id", agentId.trim());
    if (categoryId) p.set("category_id", categoryId);
    if (productId) p.set("product_id", productId);
    if (priceType.trim()) p.set("price_type", priceType.trim());
    if (territory1) p.set("territory_1", territory1);
    if (territory2) p.set("territory_2", territory2);
    if (territory3) p.set("territory_3", territory3);
    const res = await api.get(`/api/${tenantSlug}/retail-stock/export?${p.toString()}`, {
      responseType: "arraybuffer"
    });
    const blob = new Blob([res.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retail-stock-${view}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const productRows = (rows as ProductViewRow[]) ?? [];
  const categoryRows = (rows as CategoryViewRow[]) ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Остатки в торговых точках"
        description="Retail stock monitoring, shelf presence control, sell-through analytics"
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Базовая представленность</p><p className="text-2xl font-semibold">{kpi.base_presence_rate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Коффициент продажа</p><p className="text-2xl font-semibold">{kpi.sales_coefficient}</p></CardContent></Card>
      </div>

      <Card className="mt-3"><CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Фильтр</p>
          <div className="flex items-center gap-2">
            <button
              ref={dateAnchorRef}
              type="button"
              className="inline-flex h-9 min-w-[13.5rem] items-center justify-between rounded-md border border-input bg-background px-2.5 text-xs"
              onClick={() => setDateOpen((v) => !v)}
            >
              <span className="truncate">{formatDateRangeButton(dateFrom, dateTo)}</span>
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
            <Button onClick={() => void load(1)} disabled={loading}>Применить</Button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">Агент</option>
          {agents.map((a) => <option key={a.id} value={String(a.id)}>{a.fio}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Категория</option>
          {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Продукты</option>
          {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={priceType} onChange={(e) => setPriceType(e.target.value)}>
          <option value="">Тип цены</option>
          {priceTypes.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={territory1} onChange={(e) => setTerritory1(e.target.value)}>
          <option value="">Область</option>
          {regions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={territory2} onChange={(e) => setTerritory2(e.target.value)}>
          <option value="">Зона</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={territory3} onChange={(e) => setTerritory3(e.target.value)}>
          <option value="">Город</option>
          {cities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        </div>
      </CardContent></Card>

      <Card className="mt-3"><CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant={view === "products" ? "default" : "outline"} onClick={() => setView("products")}>По продуктам</Button>
            <Button variant={view === "categories" ? "default" : "outline"} onClick={() => setView("categories")}>По категории</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate}>Скачать шаблон</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload className="mr-1 h-3.5 w-3.5" />{uploading ? "Загрузка..." : "Загрузить шаблон"}</Button>
            <Button variant="outline" onClick={exportExcel}><Download className="mr-1 h-3.5 w-3.5" />Excel</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border">
          {view === "products" ? (
            <table className="w-full min-w-[1400px] text-sm">
              <thead><tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Дата</th><th className="px-3 py-2">Клиент</th><th className="px-3 py-2">Территория</th><th className="px-3 py-2">Агент</th><th className="px-3 py-2">Категория продукта</th><th className="px-3 py-2">Продукт</th><th className="px-3 py-2">Код</th><th className="px-3 py-2">Кол-во</th><th className="px-3 py-2">Кол-во (продажа)</th><th className="px-3 py-2">Объем</th><th className="px-3 py-2">Сумма</th><th className="px-3 py-2">Комментарий</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Загрузка...</td></tr>
                  : productRows.length === 0 ? <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Пусто</td></tr>
                  : productRows.map((r, i) => <tr key={`${r.stock_date}-${r.client_name}-${r.product_name}-${i}`} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDate(r.stock_date)}</td><td className="px-3 py-2 text-xs">{r.client_name}</td><td className="px-3 py-2 text-xs">{r.territory}</td><td className="px-3 py-2 text-xs">{r.agent_name ?? "—"}</td><td className="px-3 py-2 text-xs">{r.category_name ?? "—"}</td><td className="px-3 py-2 text-xs">{r.product_name}</td><td className="px-3 py-2 text-xs">{r.sku}</td><td className="px-3 py-2 text-xs">{r.quantity}</td><td className="px-3 py-2 text-xs">{r.sold_quantity}</td><td className="px-3 py-2 text-xs">{r.volume ?? "—"}</td><td className="px-3 py-2 text-xs">{r.amount}</td><td className="px-3 py-2 text-xs">{r.comment ?? "—"}</td>
                  </tr>)}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Дата</th><th className="px-3 py-2">Категория</th><th className="px-3 py-2">Кол-во</th><th className="px-3 py-2">Кол-во (продажа)</th><th className="px-3 py-2">Сумма</th><th className="px-3 py-2">Покрытие ТТ</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Загрузка...</td></tr>
                  : categoryRows.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Пусто</td></tr>
                  : categoryRows.map((r, i) => <tr key={`${r.stock_date}-${r.category_name}-${i}`} className="border-t">
                    <td className="px-3 py-2 text-xs">{fmtDate(r.stock_date)}</td><td className="px-3 py-2 text-xs">{r.category_name}</td><td className="px-3 py-2 text-xs">{r.quantity}</td><td className="px-3 py-2 text-xs">{r.sold_quantity}</td><td className="px-3 py-2 text-xs">{r.amount}</td><td className="px-3 py-2 text-xs">{r.coverage_clients}</td>
                  </tr>)}
              </tbody>
            </table>
          )}
        </div>
        {uploadResult ? (
          <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <p>Импорт: применено {uploadResult.applied} строк, ошибок: {uploadResult.errors.length}</p>
            {uploadResult.errors.length > 0 ? (
              <div className="mt-1 max-h-24 overflow-auto text-destructive">
                {uploadResult.errors.slice(0, 10).map((e, i) => (
                  <p key={`${i}-${e}`}>• {e}</p>
                ))}
                {uploadResult.errors.length > 10 ? <p>… и ещё {uploadResult.errors.length - 10}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Всего: {total} • Стр. {page}/{totalPages}</span>
          <div className="flex gap-2">
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="50">50</option><option value="100">100</option>
            </select>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>Назад</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>Вперёд</Button>
          </div>
        </div>
      </CardContent></Card>

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onApply={({ dateFrom: df, dateTo: dt }) => {
          setDateFrom(df);
          setDateTo(dt);
        }}
      />
    </PageShell>
  );
}

