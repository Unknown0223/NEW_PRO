"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AgentFormField,
  AgentFormSelect,
  AgentTemplateModalFooter,
  AgentTemplateModalHeader,
  agentModalBtnCancel,
  agentModalBtnPrimary,
  agentModalInputClass
} from "@/components/staff/agent-workspace-template-ui";
import { ConsignmentCloseScheduleFields } from "@/components/staff/consignment-close-schedule-fields";
import type { TradeDirectionCatalogRow } from "@/lib/catalog-filter-options";

const AGENT_TYPE_OPTIONS = [
  { value: "Торговый представитель", label: "Торговый представитель" },
  { value: "Мерчендайзер", label: "Мерчендайзер" },
  { value: "Супервайзер", label: "Супервайзер" },
  { value: "Экспедитор", label: "Экспедитор" }
];

export type AgentsBulkEditFields = {
  warehouse_id?: number;
  trade_direction?: string;
  branch?: string;
  position?: string;
  agent_type?: string;
  consignment?: boolean;
  close_schedule?: {
    close_day: number;
    close_hour: number;
    close_minute: number;
  };
};

type Props = {
  open: boolean;
  count: number;
  loading: boolean;
  warehouses: { id: number; name: string }[];
  branchOptions: string[];
  tradeDirections: TradeDirectionCatalogRow[];
  positions: string[];
  onClose: () => void;
  onSave: (fields: AgentsBulkEditFields) => Promise<void>;
};

/** Shablon: tanlangan agentlar uchun umumiy maydonlarni tahrirlash. */
export function AgentsBulkEditDialog({
  open,
  count,
  loading,
  warehouses,
  branchOptions,
  tradeDirections,
  positions,
  onClose,
  onSave
}: Props) {
  const [warehouseId, setWarehouseId] = useState("");
  const [tradeDirection, setTradeDirection] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [agentType, setAgentType] = useState("");
  const [consignment, setConsignment] = useState<"" | "yes" | "no">("");
  const [scheduleMode, setScheduleMode] = useState<"" | "set">("");
  const [closeDay, setCloseDay] = useState("25");
  const [closeHour, setCloseHour] = useState("0");
  const [closeMinute, setCloseMinute] = useState("0");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId("");
    setTradeDirection("");
    setBranch("");
    setPosition("");
    setAgentType("");
    setConsignment("");
    setScheduleMode("");
    setCloseDay("25");
    setCloseHour("0");
    setCloseMinute("0");
    setError(null);
  }, [open]);

  const hasChanges =
    warehouseId !== "" ||
    tradeDirection !== "" ||
    branch !== "" ||
    position !== "" ||
    agentType !== "" ||
    consignment !== "" ||
    scheduleMode === "set";

  const handleSave = async () => {
    if (!hasChanges) {
      setError("Выберите хотя бы одно поле для изменения");
      return;
    }
    setError(null);
    const body: AgentsBulkEditFields = {};
    if (warehouseId) body.warehouse_id = Number.parseInt(warehouseId, 10);
    if (tradeDirection) body.trade_direction = tradeDirection;
    if (branch) body.branch = branch;
    if (position) body.position = position;
    if (agentType) body.agent_type = agentType;
    if (consignment === "yes") body.consignment = true;
    if (consignment === "no") body.consignment = false;
    if (scheduleMode === "set") {
      const d = Number.parseInt(closeDay, 10);
      const h = Number.parseInt(closeHour, 10);
      const m = Number.parseInt(closeMinute, 10);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        setError("День закрытия: от 1 до 31");
        return;
      }
      if (!Number.isInteger(h) || h < 0 || h > 23) {
        setError("Часы закрытия: от 0 до 23");
        return;
      }
      if (!Number.isInteger(m) || m < 0 || m > 59) {
        setError("Минуты закрытия: от 0 до 59");
        return;
      }
      body.close_schedule = { close_day: d, close_hour: h, close_minute: m };
    }
    await onSave(body);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton>
        <AgentTemplateModalHeader
          title="Редактировать выбранных"
          subtitle={
            <>
              Выбрано агентов: <b className="text-slate-700">{count}</b>. Пустые поля останутся без
              изменений.
            </>
          }
        />
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
          <AgentFormField label="Склад">
            <AgentFormSelect
              value={warehouseId}
              onChange={setWarehouseId}
              emptyLabel="Не изменять"
              options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
            />
          </AgentFormField>
          <AgentFormField label="Направление торговли">
            <AgentFormSelect
              value={tradeDirection}
              onChange={setTradeDirection}
              emptyLabel="Не изменять"
              options={tradeDirections.map((t) => {
                const value = (t.code?.trim() || t.name?.trim() || "").trim();
                return {
                  value,
                  label: `${t.name}${t.code ? ` (${t.code})` : ""}`
                };
              })}
            />
          </AgentFormField>
          <AgentFormField label="Филиал">
            <AgentFormSelect
              value={branch}
              onChange={setBranch}
              emptyLabel="Не изменять"
              options={branchOptions.map((b) => ({ value: b, label: b }))}
            />
          </AgentFormField>
          <AgentFormField label="Должность">
            <AgentFormSelect
              value={position}
              onChange={setPosition}
              emptyLabel="Не изменять"
              options={positions.map((p) => ({ value: p, label: p }))}
            />
          </AgentFormField>
          <AgentFormField label="Тип агента">
            <AgentFormSelect
              value={agentType}
              onChange={setAgentType}
              emptyLabel="Не изменять"
              options={AGENT_TYPE_OPTIONS}
            />
          </AgentFormField>
          <AgentFormField label="Консигнация">
            <select
              className={agentModalInputClass}
              value={consignment}
              onChange={(e) => setConsignment(e.target.value as "" | "yes" | "no")}
            >
              <option value="">Не изменять</option>
              <option value="yes">Да</option>
              <option value="no">Нет</option>
            </select>
          </AgentFormField>
          <div className="space-y-2 rounded-lg border border-border bg-card px-3 py-2">
            <AgentFormField label="Расписание закрытия">
              <select
                className={agentModalInputClass}
                value={scheduleMode}
                onChange={(e) => setScheduleMode(e.target.value as "" | "set")}
              >
                <option value="">Не изменять</option>
                <option value="set">Задать единое…</option>
              </select>
            </AgentFormField>
            {scheduleMode === "set" ? (
              <ConsignmentCloseScheduleFields
                closeDay={closeDay}
                closeHour={closeHour}
                closeMinute={closeMinute}
                onCloseDayChange={setCloseDay}
                onCloseHourChange={setCloseHour}
                onCloseMinuteChange={setCloseMinute}
              />
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <AgentTemplateModalFooter>
          <button type="button" className={agentModalBtnCancel} onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button
            type="button"
            className={agentModalBtnPrimary}
            onClick={() => void handleSave()}
            disabled={loading || !hasChanges}
          >
            {loading ? "Сохранение…" : "Сохранить"}
          </button>
        </AgentTemplateModalFooter>
      </DialogContent>
    </Dialog>
  );
}
