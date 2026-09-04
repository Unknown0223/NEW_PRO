"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type RefOpt = { value: string; label: string };
export type StaffOpt = { id: number; name: string };
export type WhOpt = { id: number; name: string };
export type TagOpt = { id: number; name: string };

export type InlineDialogRefs = {
  agents: StaffOpt[];
  expeditors: StaffOpt[];
  warehouses: WhOpt[];
  cashDesks: WhOpt[];
  categories: RefOpt[];
  clientTypes: RefOpt[];
  clientFormats: RefOpt[];
  salesChannels: RefOpt[];
  productCategories: RefOpt[];
  regions: RefOpt[];
  districts: RefOpt[];
  cities: RefOpt[];
  neighborhoods: RefOpt[];
  zones: RefOpt[];
  priceTypes: RefOpt[];
  tags: TagOpt[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  refs: InlineDialogRefs;
  onApplyField: (sectionId: string, payload: Record<string, unknown>) => Promise<void>;
  onApplyAll: (payloads: Array<{ sectionId: string; payload: Record<string, unknown> }>) => Promise<void>;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const WEEKDAYS = [
  { v: 1, l: "Пн" },
  { v: 2, l: "Вт" },
  { v: 3, l: "Ср" },
  { v: 4, l: "Чт" },
  { v: 5, l: "Пт" },
  { v: 6, l: "Сб" },
  { v: 7, l: "Вс" }
];

function SelectField({
  label,
  value,
  onChange,
  options,
  allowEmpty = true
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: RefOpt[];
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty ? <option value="">—</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section definitions                                                */
/* ------------------------------------------------------------------ */

type SectionDef = {
  id: string;
  label: string;
  description: string;
};

const SECTIONS: SectionDef[] = [
  { id: "team", label: "Команда / маршрут", description: "Агент, дни визита и экспедитор" },
  { id: "active", label: "Активность", description: "Активный / неактивный" },
  { id: "category", label: "Категория", description: "Категория клиента" },
  { id: "type_format", label: "Тип + формат", description: "Тип и формат клиента" },
  { id: "sales_channel", label: "Канал продаж", description: "Канал продаж" },
  { id: "territory", label: "Территория", description: "Зона → Область → Город" },
  { id: "warehouse_cash", label: "Склад · Касса", description: "Привязка склада и кассы" },
  { id: "allow_order_with_debt", label: "Заказ при наличии долга", description: "Обычный заказ, консигнация" },
  { id: "product_category", label: "Категория товара", description: "Категория продаваемого товара" },
  { id: "credit_limit", label: "Кредитный лимит", description: "Лимит кредита" },
  { id: "price_type", label: "Тип цены", description: "Тип цены по умолчанию" },
  { id: "tags", label: "Теги", description: "Назначение / снятие тегов" }
];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function GroupProcessingInlineDialog({
  open,
  onOpenChange,
  selectedCount,
  refs,
  onApplyField,
  onApplyAll
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busySection, setBusySection] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());

  // Per-section form state
  const [agentId, setAgentId] = useState("");
  const [expeditorId, setExpeditorId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [slot, setSlot] = useState("1");
  const [teamMode, setTeamMode] = useState<"attach" | "detach">("attach");
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState("");
  const [clientType, setClientType] = useState("");
  const [clientFormat, setClientFormat] = useState("");
  const [salesChannel, setSalesChannel] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [zone, setZone] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [cashDeskId, setCashDeskId] = useState("");
  const [allowDebt, setAllowDebt] = useState(true);
  const [productCategory, setProductCategory] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [priceType, setPriceType] = useState("");
  const [addTagIds, setAddTagIds] = useState<number[]>([]);
  const [removeTagIds, setRemoveTagIds] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState("");

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleWd = (v: number) =>
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort()));

  const toggleTag = (id: number, list: "add" | "remove") => {
    if (list === "add") {
      setAddTagIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    } else {
      setRemoveTagIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    }
  };

  const buildPayload = useCallback(
    (sectionId: string): Record<string, unknown> | null => {
      switch (sectionId) {
        case "team": {
          const s = Math.min(100, Math.max(1, Number.parseInt(slot, 10) || 1));
          if (teamMode === "detach") {
            return { agent_assignments: [{ slot: s, agent_id: null, expeditor_user_id: null, visit_weekdays: [] }] };
          }
          const patch: Record<string, unknown> = { slot: s, visit_weekdays: weekdays };
          if (agentId) patch.agent_id = Number.parseInt(agentId, 10);
          if (expeditorId) patch.expeditor_user_id = Number.parseInt(expeditorId, 10);
          if (!agentId && !expeditorId && weekdays.length === 0) return null;
          return { agent_assignments: [patch] };
        }
        case "active":
          return { __bulk_active: isActive };
        case "category":
          return category ? { category } : null;
        case "type_format": {
          const p: Record<string, unknown> = {};
          if (clientType !== "") p.client_type_code = clientType || null;
          if (clientFormat !== "") p.client_format = clientFormat || null;
          return Object.keys(p).length > 0 ? p : null;
        }
        case "sales_channel":
          return salesChannel ? { sales_channel: salesChannel } : null;
        case "territory": {
          const p: Record<string, unknown> = {};
          if (region) p.region = region;
          if (district) p.district = district;
          if (city) p.city = city;
          if (neighborhood) p.neighborhood = neighborhood;
          if (zone) p.zone = zone;
          return Object.keys(p).length > 0 ? p : null;
        }
        case "warehouse_cash": {
          const p: Record<string, unknown> = {};
          if (warehouseId) p.warehouse_id = Number.parseInt(warehouseId, 10);
          if (cashDeskId) p.cash_desk_id = Number.parseInt(cashDeskId, 10);
          return Object.keys(p).length > 0 ? p : null;
        }
        case "allow_order_with_debt":
          return { allow_order_with_debt: allowDebt };
        case "product_category":
          return productCategory ? { product_category_ref: productCategory } : null;
        case "credit_limit": {
          const n = Number.parseFloat(creditLimit.replace(",", "."));
          return Number.isFinite(n) && n >= 0 ? { credit_limit: n } : null;
        }
        case "price_type":
          return priceType ? { price_type: priceType } : null;
        case "tags": {
          if (addTagIds.length === 0 && removeTagIds.length === 0 && !newTagName.trim()) return null;
          return {
            __bulk_tags: true,
            add_tag_ids: addTagIds,
            remove_tag_ids: removeTagIds,
            create_tag_name: newTagName.trim() || undefined
          };
        }
        default:
          return null;
      }
    },
    [
      slot, teamMode, agentId, expeditorId, weekdays, isActive, category,
      clientType, clientFormat, salesChannel, region, district, city,
      neighborhood, zone, warehouseId, cashDeskId, allowDebt,
      productCategory, creditLimit, priceType, addTagIds, removeTagIds, newTagName
    ]
  );

  const handleApplySection = async (sectionId: string) => {
    const payload = buildPayload(sectionId);
    if (!payload) return;
    setBusySection(sectionId);
    try {
      await onApplyField(sectionId, payload);
      setAppliedSections((prev) => new Set(prev).add(sectionId));
    } finally {
      setBusySection(null);
    }
  };

  const handleApplyAll = async () => {
    const payloads: Array<{ sectionId: string; payload: Record<string, unknown> }> = [];
    for (const sec of SECTIONS) {
      const payload = buildPayload(sec.id);
      if (payload) payloads.push({ sectionId: sec.id, payload });
    }
    if (payloads.length === 0) return;
    setBusyAll(true);
    try {
      await onApplyAll(payloads);
      setAppliedSections(new Set(payloads.map((p) => p.sectionId)));
    } finally {
      setBusyAll(false);
    }
  };

  const isBusy = busySection !== null || busyAll;

  const renderSectionBody = (id: string) => {
    switch (id) {
      case "team":
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={teamMode === "attach" ? "default" : "outline"} onClick={() => setTeamMode("attach")}>Бириктириш</Button>
              <Button type="button" size="sm" variant={teamMode === "detach" ? "default" : "outline"} onClick={() => setTeamMode("detach")}>Ечиш</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Слот (1–10)</Label>
              <Input className="h-8" value={slot} onChange={(e) => setSlot(e.target.value)} />
            </div>
            {teamMode === "attach" && (
              <>
                <SelectField label="Агент" value={agentId} onChange={setAgentId} options={refs.agents.map((a) => ({ value: String(a.id), label: a.name }))} />
                <SelectField label="Экспедитор" value={expeditorId} onChange={setExpeditorId} options={refs.expeditors.map((a) => ({ value: String(a.id), label: a.name }))} />
                <div className="space-y-1">
                  <Label className="text-xs">Дни визита</Label>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((d) => (
                      <Button key={d.v} type="button" size="sm" variant={weekdays.includes(d.v) ? "default" : "outline"} onClick={() => toggleWd(d.v)} className="h-7 px-2 text-xs">{d.l}</Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case "active":
        return (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={isActive ? "default" : "outline"} onClick={() => setIsActive(true)}>Актив</Button>
            <Button type="button" size="sm" variant={!isActive ? "default" : "outline"} onClick={() => setIsActive(false)}>Ноактив</Button>
          </div>
        );

      case "category":
        return <SelectField label="Категория" value={category} onChange={setCategory} options={refs.categories} />;

      case "type_format":
        return (
          <div className="space-y-2">
            <SelectField label="Тип" value={clientType} onChange={setClientType} options={refs.clientTypes} />
            <SelectField label="Формат" value={clientFormat} onChange={setClientFormat} options={refs.clientFormats} />
          </div>
        );

      case "sales_channel":
        return <SelectField label="Канал продаж" value={salesChannel} onChange={setSalesChannel} options={refs.salesChannels} />;

      case "territory":
        return (
          <div className="space-y-2">
            <SelectField label="Регион" value={region} onChange={setRegion} options={refs.regions} />
            <SelectField label="Район" value={district} onChange={setDistrict} options={refs.districts} />
            <SelectField label="Город" value={city} onChange={setCity} options={refs.cities} />
            <SelectField label="МФЙ" value={neighborhood} onChange={setNeighborhood} options={refs.neighborhoods} />
            <SelectField label="Зона" value={zone} onChange={setZone} options={refs.zones} />
          </div>
        );

      case "warehouse_cash":
        return (
          <div className="space-y-2">
            <SelectField label="Склад" value={warehouseId} onChange={setWarehouseId} options={refs.warehouses.map((w) => ({ value: String(w.id), label: w.name }))} />
            <SelectField label="Касса" value={cashDeskId} onChange={setCashDeskId} options={refs.cashDesks.map((w) => ({ value: String(w.id), label: w.name }))} />
          </div>
        );

      case "allow_order_with_debt":
        return (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={allowDebt ? "default" : "outline"} onClick={() => setAllowDebt(true)}>Рухсат</Button>
            <Button type="button" size="sm" variant={!allowDebt ? "default" : "outline"} onClick={() => setAllowDebt(false)}>Тақиқ</Button>
          </div>
        );

      case "product_category":
        return <SelectField label="Категория товара" value={productCategory} onChange={setProductCategory} options={refs.productCategories} />;

      case "credit_limit":
        return (
          <div className="space-y-1">
            <Label className="text-xs">Лимит (сўм)</Label>
            <Input className="h-8" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
          </div>
        );

      case "price_type":
        return <SelectField label="Тип цены" value={priceType} onChange={setPriceType} options={refs.priceTypes} />;

      case "tags":
        return (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Қўшиш</Label>
              <div className="flex flex-wrap gap-1">
                {refs.tags.map((t) => (
                  <Button key={`a-${t.id}`} type="button" size="sm" variant={addTagIds.includes(t.id) ? "default" : "outline"} onClick={() => toggleTag(t.id, "add")} className="h-7 px-2 text-xs">{t.name}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ечиш</Label>
              <div className="flex flex-wrap gap-1">
                {refs.tags.map((t) => (
                  <Button key={`r-${t.id}`} type="button" size="sm" variant={removeTagIds.includes(t.id) ? "destructive" : "outline"} onClick={() => toggleTag(t.id, "remove")} className="h-7 px-2 text-xs">{t.name}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Янги тег номи</Label>
              <Input className="h-8" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} maxLength={128} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,800px)] w-full max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl"
        overlayClassName="bg-black/40"
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">Групповые обработки</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Каждый раздел можно применить отдельно или все сразу.{" "}
            {selectedCount > 0 ? (
              <>
                Выбрано: <b>{selectedCount}</b>
              </>
            ) : (
              <>(сначала отметьте клиентов в списке)</>
            )}
          </p>
        </DialogHeader>

        <div className="max-h-[min(70vh,620px)] overflow-y-auto py-1">
          {SECTIONS.map((sec) => {
            const isOpen = expanded.has(sec.id);
            const isApplied = appliedSections.has(sec.id);
            const isSectionBusy = busySection === sec.id;

            return (
              <div key={sec.id} className="border-b border-border last:border-b-0">
                {/* Section header */}
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
                    "hover:bg-muted/80 focus-visible:bg-muted focus-visible:outline-none"
                  )}
                  onClick={() => toggleExpand(sec.id)}
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{sec.label}</span>
                      {isApplied && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          <Check className="size-3" /> Применено
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{sec.description}</span>
                  </span>
                </button>

                {/* Section body */}
                {isOpen && (
                  <div className="border-t border-border/50 bg-muted/30 px-5 py-3">
                    <div className="space-y-3">
                      {renderSectionBody(sec.id)}
                      <div className="flex justify-end pt-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy || selectedCount === 0}
                          onClick={() => void handleApplySection(sec.id)}
                        >
                          {isSectionBusy ? (
                            <>
                              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                              Сохраняется…
                            </>
                          ) : (
                            "Применить"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Закрыть
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isBusy || selectedCount === 0}
            onClick={() => void handleApplyAll()}
          >
            {busyAll ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Сохраняется…
              </>
            ) : (
              "Применить все"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
