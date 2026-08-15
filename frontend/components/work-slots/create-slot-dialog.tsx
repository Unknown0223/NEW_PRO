"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Hash, RefreshCw } from "lucide-react";
import {
  AgentFormField,
  AgentFormSection,
  agentModalInputClass
} from "@/components/staff/agent-workspace-template-ui";
import { WorkSlotsMultiSelect } from "./work-slots-multi-select";
import { WorkSlotFormDrawer } from "./work-slot-form-drawer";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { WorkSlotType } from "@/lib/work-slots-types";
import { SLOT_ACTIVE_STATUS_ITEMS, SLOT_TYPE_OPTIONS } from "./work-slots-utils";

type TradeDirectionOpt = { id: number; name: string; code?: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  branchOptions: string[];
  tradeDirections: TradeDirectionOpt[];
  onCreated: () => void;
};

export function CreateSlotDialog({
  open,
  onOpenChange,
  tenant,
  branchOptions,
  tradeDirections,
  onCreated
}: Props) {
  const [slotCode, setSlotCode] = useState("");
  const [label, setLabel] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [slotType, setSlotType] = useState<WorkSlotType>("agent");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestedCode = useCallback(async () => {
    if (!tenant) return;
    setCodeLoading(true);
    try {
      const p = new URLSearchParams({ slot_type: slotType });
      if (branchCode.trim()) p.set("branch_code", branchCode.trim());
      const res = await apiFetch<{ data: { slot_code: string } }>(
        `/api/${tenant}/work-slots/suggest-code?${p.toString()}`
      );
      setSlotCode(res.data.slot_code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сгенерировать код");
    } finally {
      setCodeLoading(false);
    }
  }, [tenant, slotType, branchCode]);

  const reset = () => {
    setSlotCode("");
    setLabel("");
    setBranchCode("");
    setDirectionId("");
    setSlotType("agent");
    setIsActive(true);
    setError(null);
  };

  useEffect(() => {
    if (!open || !tenant) return;
    void fetchSuggestedCode();
  }, [open, tenant, fetchSuggestedCode]);

  const validate = (): string | null => {
    const code = slotCode.trim();
    if (!code) return "Smart-код обязателен";
    if (!/^[A-Za-z0-9-]{1,32}$/.test(code)) return "Код: буквы, цифры или дефис (1–32)";
    if (!slotType) return "Выберите роль";
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dirParsed = directionId.trim() ? Number.parseInt(directionId.trim(), 10) : null;
      await apiFetch(`/api/${tenant}/work-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_code: slotCode.trim(),
          label: label.trim() || null,
          branch_code: branchCode.trim() || null,
          direction_id: Number.isFinite(dirParsed) && dirParsed != null && dirParsed > 0 ? dirParsed : null,
          slot_type: slotType,
          is_active: isActive
        })
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать");
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkSlotFormDrawer
      open={open}
      title="Новое рабочее место"
      subtitle="Заполните код, роль, филиал и направление — территорию, склад и кассу можно задать после назначения сотрудника"
      onClose={() => {
        reset();
        onOpenChange(false);
      }}
      onSubmit={() => void submit()}
      submitLabel="Создать"
      submitDisabled={!slotCode.trim() || codeLoading}
      submitBusy={saving}
      submitError={error}
    >
      <div className="space-y-5">
        <AgentFormSection title="Основное" icon={<Hash className="h-4 w-4" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <AgentFormField label="Smart-код *">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    value={slotCode}
                    onChange={(e) => setSlotCode(e.target.value.toUpperCase())}
                    maxLength={32}
                    readOnly={false}
                    placeholder="A-SERGEli-001"
                    className={`${agentModalInputClass} pr-14 font-mono`}
                    autoComplete="off"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {slotCode.length}/32
                  </span>
                </div>
                <button
                  type="button"
                  title="Подставить предложенный код"
                  disabled={codeLoading}
                  onClick={() => void fetchSuggestedCode()}
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg border border-border bg-card text-slate-600 transition hover:bg-muted disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-4", codeLoading && "animate-spin")} aria-hidden />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Можно ввести вручную или сгенерировать по роли и филиалу
              </p>
            </AgentFormField>
            <AgentFormField label="Название">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={agentModalInputClass}
                placeholder="Север — розница"
              />
            </AgentFormField>
            <AgentFormField label="Роль *">
              <WorkSlotsMultiSelect
                variant="form"
                multiple={false}
                placeholder="Роль"
                items={SLOT_TYPE_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
                selectedValues={[slotType]}
                onChange={(next) => {
                  const v = next[0];
                  if (v) setSlotType(v as WorkSlotType);
                }}
              />
            </AgentFormField>
            <AgentFormField label="Статус места">
              <WorkSlotsMultiSelect
                variant="form"
                multiple={false}
                placeholder="Статус"
                items={SLOT_ACTIVE_STATUS_ITEMS}
                selectedValues={[isActive ? "true" : "false"]}
                onChange={(next) => setIsActive((next[0] ?? "true") === "true")}
              />
            </AgentFormField>
          </div>
        </AgentFormSection>

        <AgentFormSection title="Филиал и направление" icon={<Building2 className="h-4 w-4" />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <AgentFormField label="Филиал">
              <WorkSlotsMultiSelect
                variant="form"
                multiple={false}
                placeholder={branchOptions.length ? "Филиал" : "Нет филиалов в справочнике"}
                items={[
                  { id: "__none__", title: "—" },
                  ...branchOptions.map((b) => ({ id: b, title: b }))
                ]}
                selectedValues={branchCode ? [branchCode] : []}
                onChange={(next) => {
                  const v = next[0] ?? "";
                  setBranchCode(v === "__none__" ? "" : v);
                }}
              />
            </AgentFormField>
            <AgentFormField label="Направление торговли">
              <WorkSlotsMultiSelect
                variant="form"
                multiple={false}
                placeholder={tradeDirections.length ? "Направление" : "Нет направлений"}
                items={[
                  { id: "__none__", title: "—" },
                  ...tradeDirections.map((t) => ({
                    id: String(t.id),
                    title: t.code ? `${t.name} (${t.code})` : t.name
                  }))
                ]}
                selectedValues={directionId ? [directionId] : []}
                onChange={(next) => {
                  const v = next[0] ?? "";
                  setDirectionId(v === "__none__" ? "" : v);
                }}
              />
            </AgentFormField>
          </div>
        </AgentFormSection>
      </div>
    </WorkSlotFormDrawer>
  );
}
