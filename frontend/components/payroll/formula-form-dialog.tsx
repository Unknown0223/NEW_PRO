"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUserFacingError } from "@/lib/error-utils";
import { PAYROLL_KIND_LABEL_RU } from "./payroll-api";
import type { PayrollComponentDto, PayrollFormulaConfigDto, PayrollFormulaRow, PayrollGateDto } from "./payroll-api";
import { ComponentsEditor, GatesEditor, PAYROLL_METRIC_OPTIONS, RolesPicker } from "./formula-parts-editor";

type Props = {
  open: boolean;
  row?: PayrollFormulaRow | null;
  roles: Array<{ role: string; label: string }>;
  kpiGroups: Array<{ id: number; name: string }>;
  grids: Array<{ id: number; name: string; metric: string }>;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSaveRequest: (body: Record<string, unknown>) => Promise<unknown>;
};

function num(v: string, fallback = 0): number {
  if (v.trim() === "") return fallback;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/** Formula parametrlari bo‘yicha qaysi maydonlar kerakligini aniqlash. */
function fieldsForKind(kind: string): { percent?: boolean; rate?: boolean; percentMetric?: boolean; unitMetric?: boolean } {
  switch (kind) {
    case "percent_sales":
      return { percent: true, percentMetric: true };
    case "team_percent":
      return { percent: true, percentMetric: true };
    case "kpi_bonus":
      return { percent: true };
    case "per_delivery":
      return { percent: true, rate: true, unitMetric: true };
    case "per_collection":
      return { percent: true, rate: true };
    case "per_visit":
    case "piece":
      return { rate: true, unitMetric: true };
    default:
      return {};
  }
}

export function FormulaFormDialog({
  open,
  row,
  roles,
  kpiGroups,
  grids,
  onOpenChange,
  saving,
  onSaveRequest
}: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState("kpi_bonus");
  const [roleList, setRoleList] = useState<string[]>([]);
  const [kpiGroupId, setKpiGroupId] = useState<string>("");
  const [gridId, setGridId] = useState<string>("");
  const [baseAmount, setBaseAmount] = useState("0");
  const [percent, setPercent] = useState("");
  const [percentMetric, setPercentMetric] = useState("sales_sum");
  const [rate, setRate] = useState("");
  const [unitMetric, setUnitMetric] = useState("deliveries");
  const [prorate, setProrate] = useState<"base" | "all" | "none">("base");
  const [roundTo, setRoundTo] = useState("");
  const [maxNet, setMaxNet] = useState("");
  const [priority, setPriority] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [components, setComponents] = useState<PayrollComponentDto[]>([]);
  const [gates, setGates] = useState<PayrollGateDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(row?.name ?? "");
    setCode(row?.code ?? "");
    setKind(row?.kind ?? "kpi_bonus");
    setRoleList(row?.roles ?? []);
    setKpiGroupId(row?.kpi_group_id ? String(row.kpi_group_id) : "");
    setGridId(row?.grid_id ? String(row.grid_id) : "");
    setBaseAmount(String(row?.base_amount ?? 0));
    setPercent(row?.config?.percent != null ? String(row.config.percent) : "");
    setPercentMetric(row?.config?.percent_metric ?? "sales_sum");
    setRate(row?.config?.rate_per_unit != null ? String(row.config.rate_per_unit) : "");
    setUnitMetric(row?.config?.unit_metric ?? "deliveries");
    setProrate(row?.config?.attendance_prorate ?? "base");
    setRoundTo(row?.config?.round_to != null ? String(row.config.round_to) : "");
    setMaxNet(row?.config?.max_net != null ? String(row.config.max_net) : "");
    setPriority(String(row?.priority ?? 0));
    setIsDefault(row?.is_default ?? false);
    setIsActive(row?.is_active ?? true);
    setComponents(row?.components ?? []);
    setGates(row?.gates ?? []);
  }, [open, row]);

  const visible = fieldsForKind(kind);

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Nom majburiy.");
      return;
    }
    const config: PayrollFormulaConfigDto = { attendance_prorate: prorate };
    if (percent.trim() !== "") config.percent = num(percent);
    if (rate.trim() !== "") config.rate_per_unit = num(rate);
    if (visible.percentMetric) config.percent_metric = percentMetric;
    if (visible.unitMetric) config.unit_metric = unitMetric;
    if (roundTo.trim() !== "") config.round_to = Math.max(1, Math.round(num(roundTo, 1)));
    if (maxNet.trim() !== "") config.max_net = num(maxNet);

    const body: Record<string, unknown> = {
      name: name.trim(),
      code: code.trim() || null,
      kind,
      roles: roleList,
      kpi_group_id: kpiGroupId ? Number(kpiGroupId) : null,
      grid_id: gridId ? Number(gridId) : null,
      base_amount: num(baseAmount),
      config,
      components,
      gates,
      priority: Math.round(num(priority)),
      is_default: isDefault,
      is_active: isActive
    };

    try {
      await onSaveRequest(body);
      onOpenChange(false);
    } catch (e) {
      setError(getUserFacingError(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{row ? "Формуланы таҳрирлаш" : "Янги формула"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Название *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Agent — KPI сетка" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Код</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AGENT_KPI" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Вид расчёта</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {Object.entries(PAYROLL_KIND_LABEL_RU).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Оклад (сўм)</Label>
            <Input inputMode="decimal" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Роли</Label>
            <RolesPicker roles={roles} value={roleList} onChange={setRoleList} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Группа KPI</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={kpiGroupId}
              onChange={(e) => setKpiGroupId(e.target.value)}
            >
              <option value="">Без группы (по роли)</option>
              {kpiGroups.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Tanlansa — formula faqat shu guruhga bog‘langan xodimlarga qo‘llanadi.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Сетка</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={gridId}
              onChange={(e) => setGridId(e.target.value)}
            >
              <option value="">Сеткаsiz</option>
              {grids.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name} ({g.metric})
                </option>
              ))}
            </select>
          </div>

          {visible.percent ? (
            <div className="space-y-1">
              <Label className="text-xs">Процент (%)</Label>
              <Input inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
            </div>
          ) : null}

          {visible.percentMetric ? (
            <div className="space-y-1">
              <Label className="text-xs">База процента</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={percentMetric}
                onChange={(e) => setPercentMetric(e.target.value)}
              >
                <option value="sales_sum">Продажи (сумма)</option>
                <option value="team_sales_sum">Продажи команды</option>
                <option value="collection_sum">Инкассация</option>
              </select>
            </div>
          ) : null}

          {visible.rate ? (
            <div className="space-y-1">
              <Label className="text-xs">Ставка за единицу (сўм)</Label>
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          ) : null}

          {visible.unitMetric ? (
            <div className="space-y-1">
              <Label className="text-xs">Единица</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={unitMetric}
                onChange={(e) => setUnitMetric(e.target.value)}
              >
                {PAYROLL_METRIC_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label className="text-xs">Давomat</Label>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
              value={prorate}
              onChange={(e) => setProrate(e.target.value as typeof prorate)}
            >
              <option value="base">Окладга proporsional</option>
              <option value="all">Hammasiga proporsional</option>
              <option value="none">Hisobga olinmasin</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Yaxlitlash</Label>
              <Input inputMode="numeric" value={roundTo} onChange={(e) => setRoundTo(e.target.value)} placeholder="100" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Maks. summa</Label>
              <Input inputMode="decimal" value={maxNet} onChange={(e) => setMaxNet(e.target.value)} />
            </div>
          </div>
        </div>

        <ComponentsEditor value={components} onChange={setComponents} />
        <GatesEditor value={gates} onChange={setGates} />

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Rol bo‘yicha standart
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Faol
          </label>
          <label className="flex items-center gap-1.5">
            Prioritet
            <Input
              className="h-7 w-20 text-xs"
              inputMode="numeric"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </label>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "Сақланмоқда…" : "Сақлаш"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
