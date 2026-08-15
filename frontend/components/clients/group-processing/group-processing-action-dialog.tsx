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
import type { GroupProcessingActionId } from "@/components/clients/group-processing/group-processing-actions";
import { useMemo, useState } from "react";

const WEEKDAYS = [
  { v: 1, l: "Du" },
  { v: 2, l: "Se" },
  { v: 3, l: "Ch" },
  { v: 4, l: "Pa" },
  { v: 5, l: "Ju" },
  { v: 6, l: "Sh" },
  { v: 7, l: "Ya" }
];

export type StaffOpt = { id: number; name: string };
export type RefOpt = { value: string; label: string };
export type TagOpt = { id: number; name: string };
export type WhOpt = { id: number; name: string };

export type GroupActionDialogProps = {
  open: boolean;
  actionId: GroupProcessingActionId | null;
  selectedCount: number;
  pending: boolean;
  onClose: () => void;
  onApply: (payload: Record<string, unknown>) => void;
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

function SelectField({
  label,
  value,
  onChange,
  options,
  allowEmpty
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: RefOpt[];
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty !== false ? <option value="">—</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function GroupProcessingActionDialog(props: GroupActionDialogProps) {
  const { open, actionId, selectedCount, pending, onClose, onApply } = props;
  const title = useMemo(() => {
    switch (actionId) {
      case "team":
        return "Jamoa / marshrut";
      case "active":
        return "Faollik";
      case "territory":
        return "Hudud";
      case "category":
        return "Kategoriya";
      case "type_format":
        return "Tip + format";
      case "sales_channel":
        return "Savdo kanali";
      case "product_category":
        return "Mahsulot kategoriyasi";
      case "client_code":
        return "Kod";
      case "warehouse_cash":
        return "Ombor + kassa";
      case "credit_limit":
        return "Kredit limiti";
      case "price_type":
        return "Tip narxi";
      case "allow_order_with_debt":
        return "Qarzdorlikda zakaz";
      case "tags":
        return "Teglar";
      default:
        return "Amal";
    }
  }, [actionId]);

  const [mode, setMode] = useState<"attach" | "detach">("attach");
  const [agentId, setAgentId] = useState("");
  const [expeditorId, setExpeditorId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [slot, setSlot] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [zone, setZone] = useState("");
  const [category, setCategory] = useState("");
  const [clientType, setClientType] = useState("");
  const [clientFormat, setClientFormat] = useState("");
  const [salesChannel, setSalesChannel] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [cashDeskId, setCashDeskId] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [priceType, setPriceType] = useState("");
  const [allowDebt, setAllowDebt] = useState(true);
  const [addTagIds, setAddTagIds] = useState<number[]>([]);
  const [removeTagIds, setRemoveTagIds] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState("");

  const toggleWd = (v: number) => {
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort()));
  };

  const toggleTag = (id: number, list: "add" | "remove") => {
    if (list === "add") {
      setAddTagIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    } else {
      setRemoveTagIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    }
  };

  const submit = () => {
    if (!actionId) return;
    switch (actionId) {
      case "team": {
        const s = Math.min(10, Math.max(1, Number.parseInt(slot, 10) || 1));
        if (mode === "detach") {
          onApply({
            agent_assignments: [
              {
                slot: s,
                agent_id: null,
                expeditor_user_id: null,
                visit_weekdays: []
              }
            ]
          });
        } else {
          const patch: Record<string, unknown> = {
            slot: s,
            visit_weekdays: weekdays
          };
          if (agentId) patch.agent_id = Number.parseInt(agentId, 10);
          if (expeditorId) patch.expeditor_user_id = Number.parseInt(expeditorId, 10);
          onApply({ agent_assignments: [patch] });
        }
        break;
      }
      case "active":
        onApply({ __bulk_active: isActive });
        break;
      case "territory": {
        const patch: Record<string, unknown> = {};
        if (region) patch.region = region;
        if (district) patch.district = district;
        if (city) patch.city = city;
        if (neighborhood) patch.neighborhood = neighborhood;
        if (zone) patch.zone = zone;
        onApply(patch);
        break;
      }
      case "category":
        onApply({ category: category || null });
        break;
      case "type_format": {
        const patch: Record<string, unknown> = {};
        if (clientType !== "") patch.client_type_code = clientType || null;
        if (clientFormat !== "") patch.client_format = clientFormat || null;
        onApply(patch);
        break;
      }
      case "sales_channel":
        onApply({ sales_channel: salesChannel || null });
        break;
      case "product_category":
        onApply({ product_category_ref: productCategory || null });
        break;
      case "client_code":
        onApply({ client_code: clientCode.trim() || null });
        break;
      case "warehouse_cash": {
        const patch: Record<string, unknown> = {};
        if (warehouseId) patch.warehouse_id = Number.parseInt(warehouseId, 10);
        if (cashDeskId) patch.cash_desk_id = Number.parseInt(cashDeskId, 10);
        onApply(patch);
        break;
      }
      case "credit_limit": {
        const n = Number.parseFloat(creditLimit.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) return;
        onApply({ credit_limit: n });
        break;
      }
      case "price_type":
        onApply({ price_type: priceType || null });
        break;
      case "allow_order_with_debt":
        onApply({ allow_order_with_debt: allowDebt });
        break;
      case "tags":
        onApply({
          __bulk_tags: true,
          add_tag_ids: addTagIds,
          remove_tag_ids: removeTagIds,
          create_tag_name: newTagName.trim() || undefined
        });
        break;
      default:
        break;
    }
  };

  if (!actionId || actionId === "map") return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {title} — {selectedCount} ta mijoz
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {actionId === "team" ? (
            <>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "attach" ? "default" : "outline"}
                  onClick={() => setMode("attach")}
                >
                  Biriktirish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "detach" ? "default" : "outline"}
                  onClick={() => setMode("detach")}
                >
                  Yechish
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Slot (1–10)</Label>
                <Input value={slot} onChange={(e) => setSlot(e.target.value)} />
              </div>
              {mode === "attach" ? (
                <>
                  <SelectField
                    label="Agent"
                    value={agentId}
                    onChange={setAgentId}
                    options={props.agents.map((a) => ({ value: String(a.id), label: a.name }))}
                  />
                  <SelectField
                    label="Ekspeditor"
                    value={expeditorId}
                    onChange={setExpeditorId}
                    options={props.expeditors.map((a) => ({ value: String(a.id), label: a.name }))}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tashrif kunlari</Label>
                    <div className="flex flex-wrap gap-1">
                      {WEEKDAYS.map((d) => (
                        <Button
                          key={d.v}
                          type="button"
                          size="sm"
                          variant={weekdays.includes(d.v) ? "default" : "outline"}
                          onClick={() => toggleWd(d.v)}
                        >
                          {d.l}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tanlangan slot dagi agent, ekspeditor va kunlar tozalanadi.
                </p>
              )}
            </>
          ) : null}

          {actionId === "active" ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                onClick={() => setIsActive(true)}
              >
                Aktiv
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!isActive ? "default" : "outline"}
                onClick={() => setIsActive(false)}
              >
                Nofaol
              </Button>
            </div>
          ) : null}

          {actionId === "territory" ? (
            <>
              <SelectField label="Region" value={region} onChange={setRegion} options={props.regions} />
              <SelectField label="Tuman" value={district} onChange={setDistrict} options={props.districts} />
              <SelectField label="Shahar" value={city} onChange={setCity} options={props.cities} />
              <SelectField
                label="MFY"
                value={neighborhood}
                onChange={setNeighborhood}
                options={props.neighborhoods}
              />
              <SelectField label="Zona" value={zone} onChange={setZone} options={props.zones} />
            </>
          ) : null}

          {actionId === "category" ? (
            <SelectField label="Kategoriya" value={category} onChange={setCategory} options={props.categories} />
          ) : null}

          {actionId === "type_format" ? (
            <>
              <SelectField label="Tip" value={clientType} onChange={setClientType} options={props.clientTypes} />
              <SelectField
                label="Format"
                value={clientFormat}
                onChange={setClientFormat}
                options={props.clientFormats}
              />
            </>
          ) : null}

          {actionId === "sales_channel" ? (
            <SelectField
              label="Kanal"
              value={salesChannel}
              onChange={setSalesChannel}
              options={props.salesChannels}
            />
          ) : null}

          {actionId === "product_category" ? (
            <SelectField
              label="Mahsulot kategoriyasi"
              value={productCategory}
              onChange={setProductCategory}
              options={props.productCategories}
            />
          ) : null}

          {actionId === "client_code" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Kod</Label>
              <Input value={clientCode} onChange={(e) => setClientCode(e.target.value)} maxLength={32} />
            </div>
          ) : null}

          {actionId === "warehouse_cash" ? (
            <>
              <SelectField
                label="Ombor"
                value={warehouseId}
                onChange={setWarehouseId}
                options={props.warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
              />
              <SelectField
                label="Kassa"
                value={cashDeskId}
                onChange={setCashDeskId}
                options={props.cashDesks.map((w) => ({ value: String(w.id), label: w.name }))}
              />
            </>
          ) : null}

          {actionId === "credit_limit" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Limit (so‘m)</Label>
              <Input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
            </div>
          ) : null}

          {actionId === "price_type" ? (
            <SelectField label="Narx turi" value={priceType} onChange={setPriceType} options={props.priceTypes} />
          ) : null}

          {actionId === "allow_order_with_debt" ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={allowDebt ? "default" : "outline"}
                onClick={() => setAllowDebt(true)}
              >
                Ruxsat
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!allowDebt ? "default" : "outline"}
                onClick={() => setAllowDebt(false)}
              >
                Taqiq
              </Button>
            </div>
          ) : null}

          {actionId === "tags" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Qo‘shish</Label>
                <div className="flex flex-wrap gap-1">
                  {props.tags.map((t) => (
                    <Button
                      key={`a-${t.id}`}
                      type="button"
                      size="sm"
                      variant={addTagIds.includes(t.id) ? "default" : "outline"}
                      onClick={() => toggleTag(t.id, "add")}
                    >
                      {t.name}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yechish</Label>
                <div className="flex flex-wrap gap-1">
                  {props.tags.map((t) => (
                    <Button
                      key={`r-${t.id}`}
                      type="button"
                      size="sm"
                      variant={removeTagIds.includes(t.id) ? "destructive" : "outline"}
                      onClick={() => toggleTag(t.id, "remove")}
                    >
                      {t.name}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yangi teg nomi (ixtiyoriy)</Label>
                <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} maxLength={128} />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Bekor
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Saqlanmoqda…" : "Qo‘llash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
