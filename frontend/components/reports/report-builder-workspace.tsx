"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarDays, Eye, FileSpreadsheet, GripVertical, Loader2, Save, X } from "lucide-react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { filterSelectClassName } from "@/components/ui/filter-select";

const DATASET_ID = "orders_sales_lines" as const;

type DateMode = "order_date" | "shipped_date" | "delivered_date" | "created_date";

type Metrics = { amount: boolean; qty: boolean; volume: boolean; akb: boolean };

type ConfigPayload = {
  datasetId: typeof DATASET_ID;
  dateMode: DateMode;
  dateFrom: string;
  dateTo: string;
  agentIds: number[];
  statuses: string[];
  orderTypes: string[];
  rowFieldIds: string[];
  colFieldIds: string[];
  metrics: Metrics;
};

type Metadata = {
  datasets: Array<{ id: string; label: string }>;
  dateModes: Array<{ id: DateMode; label: string }>;
  fields: Array<{ id: string; label: string; allowRow: boolean; allowCol: boolean }>;
  metrics: Array<{ id: keyof Metrics; label: string }>;
};

type FilterOpts = {
  agents: Array<{ id: number; name: string; code: string | null }>;
  statuses: Array<{ id: string; label: string }>;
  order_types: Array<{ id: string; label: string }>;
};

type PreviewData = {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  totalRowCount: number;
  matrix?: {
    enabled: boolean;
    rowLabels: string[];
    colKeys: string[];
    cells: (number | null)[][];
    metric: string | null;
  };
};

function defaultRange() {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  const from = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0, 0, 0, 0, 0)).toISOString().slice(0, 10);
  return { from, to };
}

function defaultConfig(): ConfigPayload {
  const r = defaultRange();
  return {
    datasetId: DATASET_ID,
    dateMode: "order_date",
    dateFrom: r.from,
    dateTo: r.to,
    agentIds: [],
    statuses: [],
    orderTypes: [],
    rowFieldIds: [],
    colFieldIds: [],
    metrics: { amount: true, qty: false, volume: false, akb: false }
  };
}

const PALETTE_PREFIX = "palette:";
const ROW_ZONE = "row-zone";
const COL_ZONE = "col-zone";

function PaletteChip({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${id}`,
    data: { fieldId: id },
    disabled
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs",
        disabled && "cursor-not-allowed opacity-40",
        isDragging && "opacity-60"
      )}
      {...listeners}
      {...attributes}
      disabled={disabled}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function DropZone({
  id,
  title,
  description,
  children
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[88px] rounded-md border-2 border-dashed p-2 transition-colors",
        isOver ? "border-primary/60 bg-primary/5" : "border-border/80 bg-muted/20"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[10px] text-muted-foreground">{description}</span>
      </div>
      {children}
    </div>
  );
}

function SortFieldRow({
  id,
  label,
  onRemove
}: {
  id: string;
  label: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="mb-1 flex items-center gap-1 rounded border border-border bg-background px-1 py-0.5 text-xs">
      <button type="button" className="touch-none p-0.5 text-muted-foreground" {...listeners} {...attributes} aria-label="Перетащить">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove} aria-label="Удалить">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function ReportBuilderWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [config, setConfig] = useState<ConfigPayload>(() => defaultConfig());
  const [saveName, setSaveName] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const metaQ = useQuery({
    queryKey: ["report-builder-metadata", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Metadata }>(`/api/${tenantSlug}/reports/report-builder/metadata`);
      return data.data;
    }
  });

  const filtersQ = useQuery({
    queryKey: ["report-builder-filters", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOpts }>(`/api/${tenantSlug}/reports/report-builder/filter-options`);
      return data.data;
    }
  });

  const savedQ = useQuery({
    queryKey: ["report-builder-saved", tenantSlug],
    enabled: Boolean(tenantSlug && hydrated),
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string; config: ConfigPayload }> }>(
        `/api/${tenantSlug}/reports/report-builder/saved`
      );
      return data.data;
    }
  });

  const previewMut = useMutation({
    mutationFn: async (body: ConfigPayload) => {
      const { data } = await api.post<{ data: PreviewData }>(`/api/${tenantSlug}/reports/report-builder/preview`, body);
      return data.data;
    },
    onSuccess: (d) => setPreview(d)
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const name = saveName.trim();
      if (!name) throw new Error("EMPTY_NAME");
      await api.post(`/api/${tenantSlug}/reports/report-builder/saved`, { name, config });
    },
    onSuccess: () => {
      setSaveName("");
      void qc.invalidateQueries({ queryKey: ["report-builder-saved", tenantSlug] });
    }
  });

  const exportMut = useMutation({
    mutationFn: async (body: ConfigPayload) => {
      const res = await api.post<Blob>(`/api/${tenantSlug}/reports/report-builder/export`, body, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "report-builder.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  });

  const fieldById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of metaQ.data?.fields ?? []) m.set(f.id, f.label);
    return m;
  }, [metaQ.data?.fields]);

  const usedIds = useMemo(() => new Set([...config.rowFieldIds, ...config.colFieldIds]), [config.rowFieldIds, config.colFieldIds]);

  const agentItems = useMemo(
    () => (filtersQ.data?.agents ?? []).map((a) => ({ id: String(a.id), title: a.code ? `${a.code} — ${a.name}` : a.name })),
    [filtersQ.data?.agents]
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = e;
      if (!over) return;
      const aid = String(active.id);
      const oid = String(over.id);

      if (aid.startsWith(PALETTE_PREFIX)) {
        const fieldId = aid.slice(PALETTE_PREFIX.length);
        const f = metaQ.data?.fields.find((x) => x.id === fieldId);
        if (!f) return;
        if (oid === ROW_ZONE && f.allowRow && !config.rowFieldIds.includes(fieldId)) {
          setConfig((c) => ({ ...c, rowFieldIds: [...c.rowFieldIds, fieldId] }));
        }
        if (oid === COL_ZONE && f.allowCol && !config.colFieldIds.includes(fieldId)) {
          setConfig((c) => ({ ...c, colFieldIds: [...c.colFieldIds, fieldId] }));
        }
        return;
      }

      if (config.rowFieldIds.includes(aid) && config.rowFieldIds.includes(oid) && aid !== oid) {
        setConfig((c) => {
          const oldIndex = c.rowFieldIds.indexOf(aid);
          const newIndex = c.rowFieldIds.indexOf(oid);
          if (oldIndex < 0 || newIndex < 0) return c;
          return { ...c, rowFieldIds: arrayMove(c.rowFieldIds, oldIndex, newIndex) };
        });
        return;
      }
      if (config.colFieldIds.includes(aid) && config.colFieldIds.includes(oid) && aid !== oid) {
        setConfig((c) => {
          const oldIndex = c.colFieldIds.indexOf(aid);
          const newIndex = c.colFieldIds.indexOf(oid);
          if (oldIndex < 0 || newIndex < 0) return c;
          return { ...c, colFieldIds: arrayMove(c.colFieldIds, oldIndex, newIndex) };
        });
      }
    },
    [config.colFieldIds, config.rowFieldIds, metaQ.data?.fields]
  );

  const loadSaved = useCallback(
    (id: number) => {
      const row = savedQ.data?.find((x) => x.id === id);
      if (row?.config) {
        setConfig({ ...defaultConfig(), ...row.config, dateFrom: row.config.dateFrom, dateTo: row.config.dateTo });
        setPreview(null);
      }
    },
    [savedQ.data]
  );

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  const periodBtn = formatDateRangeButton(config.dateFrom, config.dateTo);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveDragId(String(e.active.id))}
      onDragEnd={onDragEnd}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Конструктор отчетов</h1>
            <p className="text-xs text-muted-foreground">Динамический отчёт по строкам заказа</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/reports/builder"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 text-xs")}
            >
              Новая версия (WebDataRocks)
            </Link>
            <select
              className={cn(filterSelectClassName, "h-9 max-w-[14rem] text-xs")}
              value={DATASET_ID}
              disabled
              title="В следующих версиях — другие наборы данных"
            >
              {(metaQ.data?.datasets ?? [{ id: DATASET_ID, label: "Продажи (строки заказа)" }]).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              ref={dateAnchorRef}
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 shrink-0 gap-2 font-normal",
                dateOpen && "border-primary/60 bg-primary/5"
              )}
              onClick={() => setDateOpen((o) => !o)}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Дата</span>
              <span className="text-sm font-medium tabular-nums">{periodBtn}</span>
            </button>
          </div>
        </div>

        <DateRangePopover
          open={dateOpen}
          onOpenChange={setDateOpen}
          anchorRef={dateAnchorRef}
          dateFrom={config.dateFrom}
          dateTo={config.dateTo}
          onApply={({ dateFrom, dateTo }) => setConfig((c) => ({ ...c, dateFrom, dateTo }))}
        />

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Фильтр</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="min-w-0">
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Агент</span>
                <SearchableMultiSelectPanel
                  label="Агент"
                  hideOuterLabel
                  hidePopoverHeader
                  triggerPlaceholder="Агент"
                  triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                  items={agentItems}
                  selected={new Set(config.agentIds.map(String))}
                  onSelectedChange={(next) => {
                    const s = typeof next === "function" ? next(new Set(config.agentIds.map(String))) : next;
                    setConfig((c) => ({
                      ...c,
                      agentIds: Array.from(s).map((x) => Number.parseInt(String(x), 10)).filter((n) => n > 0)
                    }));
                  }}
                  searchable
                  searchPlaceholder="Агент"
                  minPopoverWidth={220}
                  maxListHeightClass="max-h-40"
                />
              </div>
              <div className="min-w-0">
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Статус</span>
                <SearchableMultiSelectPanel
                  label="Статус"
                  hideOuterLabel
                  hidePopoverHeader
                  triggerPlaceholder="Статус"
                  triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                  items={(filtersQ.data?.statuses ?? []).map((s) => ({ id: s.id, title: s.label }))}
                  selected={new Set(config.statuses)}
                  onSelectedChange={(next) => {
                    const s = typeof next === "function" ? next(new Set(config.statuses)) : next;
                    setConfig((c) => ({ ...c, statuses: Array.from(s) }));
                  }}
                  searchable
                  searchPlaceholder="Статус"
                  minPopoverWidth={200}
                  maxListHeightClass="max-h-40"
                  selectAllLabel="Выбрать все"
                />
              </div>
              <div className="min-w-0">
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Заказ</span>
                <SearchableMultiSelectPanel
                  label="Тип заказа"
                  hideOuterLabel
                  hidePopoverHeader
                  triggerPlaceholder="Тип заказа"
                  triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
                  items={(filtersQ.data?.order_types ?? []).map((s) => ({ id: s.id, title: s.label }))}
                  selected={new Set(config.orderTypes)}
                  onSelectedChange={(next) => {
                    const s = typeof next === "function" ? next(new Set(config.orderTypes)) : next;
                    setConfig((c) => ({ ...c, orderTypes: Array.from(s) }));
                  }}
                  searchable
                  searchPlaceholder="Тип"
                  minPopoverWidth={200}
                  maxListHeightClass="max-h-36"
                  selectAllLabel="Выбрать все"
                />
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Дата применяется по</span>
              <div className="flex flex-wrap gap-3 text-xs">
                {(
                  metaQ.data?.dateModes ?? [
                    { id: "order_date" as const, label: "Дата заказа" },
                    { id: "shipped_date" as const, label: "Дата отправки" },
                    { id: "delivered_date" as const, label: "Дата доставки" },
                    { id: "created_date" as const, label: "Дата создания" }
                  ]
                ).map((dm) => (
                  <label key={dm.id} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="rb-date-mode"
                      checked={config.dateMode === dm.id}
                      onChange={() => setConfig((c) => ({ ...c, dateMode: dm.id }))}
                    />
                    {dm.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Метрики</span>
              <div className="flex flex-wrap gap-4 text-xs">
                {(metaQ.data?.metrics ?? []).map((m) => (
                  <label key={m.id} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={config.metrics[m.id]}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          metrics: { ...c.metrics, [m.id]: e.target.checked }
                        }))
                      }
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Доступные поля</CardTitle>
            <p className="text-xs text-muted-foreground">Перетащите в «Строка» или «Столбец»</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 pt-0">
            {(metaQ.data?.fields ?? []).map((f) => (
              <PaletteChip key={f.id} id={f.id} label={f.label} disabled={usedIds.has(f.id)} />
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-3 lg:grid-cols-2">
          <DropZone id={ROW_ZONE} title="Строка" description="Группировка по вертикали">
            <SortableContext items={config.rowFieldIds} strategy={verticalListSortingStrategy}>
              {config.rowFieldIds.map((id) => (
                <SortFieldRow
                  key={id}
                  id={id}
                  label={fieldById.get(id) ?? id}
                  onRemove={() => setConfig((c) => ({ ...c, rowFieldIds: c.rowFieldIds.filter((x) => x !== id) }))}
                />
              ))}
            </SortableContext>
          </DropZone>
          <DropZone id={COL_ZONE} title="Столбец" description="Пивот (горизонталь)">
            <SortableContext items={config.colFieldIds} strategy={verticalListSortingStrategy}>
              {config.colFieldIds.map((id) => (
                <SortFieldRow
                  key={id}
                  id={id}
                  label={fieldById.get(id) ?? id}
                  onRemove={() => setConfig((c) => ({ ...c, colFieldIds: c.colFieldIds.filter((x) => x !== id) }))}
                />
              ))}
            </SortableContext>
          </DropZone>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-auto flex max-w-md flex-1 flex-wrap items-center gap-2">
            <select
              className={cn(filterSelectClassName, "h-8 max-w-[12rem] text-xs")}
              onChange={(e) => {
                const v = e.target.value;
                if (v) loadSaved(Number.parseInt(v, 10));
                e.target.value = "";
              }}
              defaultValue=""
            >
              <option value="">Загрузить сохранённый…</option>
              {(savedQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Input
              className="h-8 max-w-[10rem] text-xs"
              placeholder="Имя для сохранения"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1"
              disabled={saveMut.isPending}
              onClick={() =>
                void saveMut.mutateAsync().catch((err: unknown) => {
                  window.alert(getUserFacingError(err, "Ошибка сохранения"));
                })
              }
            >
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Сохранить
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 bg-orange-600 hover:bg-orange-600/90"
            disabled={previewMut.isPending}
            onClick={() => void previewMut.mutateAsync(config)}
          >
            {previewMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            Просмотр
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            disabled={exportMut.isPending}
            onClick={() => void exportMut.mutateAsync(config)}
          >
            {exportMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            Excel
          </Button>
        </div>

        {preview && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Результат</CardTitle>
              <span className="text-xs text-muted-foreground">
                Строк: {preview.rows.length}
                {preview.truncated ? " (усечено)" : ""} / всего групп: {preview.totalRowCount}
              </span>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {(() => {
                const mx = preview.matrix;
                if (!mx?.enabled || mx.colKeys.length === 0) return null;
                return (
                  <div className="overflow-x-auto rounded-md border">
                    <p className="border-b bg-muted/40 px-2 py-1 text-xs font-medium">
                      Матрица ({mx.metric}) — строки × столбцы
                    </p>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className="border-b border-r bg-muted/30 px-2 py-1 text-left"> </th>
                          {mx.colKeys.map((ck) => (
                            <th key={ck} className="border-b border-r px-2 py-1 text-right font-medium last:border-r-0">
                              {ck}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mx.rowLabels.map((rl, ri) => (
                          <tr key={rl} className="border-b border-border/60">
                            <td className="border-r bg-muted/20 px-2 py-1 font-medium">{rl}</td>
                            {mx.cells[ri]?.map((cell, ci) => (
                              <td key={ci} className="border-r px-2 py-1 text-right tabular-nums last:border-r-0">
                                {cell == null ? "—" : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {preview.columns.map((col) => (
                        <th key={col} className="whitespace-nowrap px-2 py-2 text-left font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(1, preview.columns.length)} className="px-2 py-6 text-center text-muted-foreground">
                          Нет данных
                        </td>
                      </tr>
                    ) : (
                      preview.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border/60 hover:bg-muted/10">
                          {preview.columns.map((col) => (
                            <td key={col} className="max-w-[14rem] truncate px-2 py-1">
                              {row[col] == null ? "—" : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <DragOverlay dropAnimation={null}>
          {activeDragId?.startsWith(PALETTE_PREFIX) ? (
            <span className="rounded-md border bg-background px-2 py-1 text-xs shadow-md">
              {fieldById.get(activeDragId.slice(PALETTE_PREFIX.length)) ?? activeDragId}
            </span>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
