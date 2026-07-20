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

const AGENT_TYPE_OPTIONS = [
  { value: "Торговый представитель", label: "Торговый представитель" },
  { value: "Мерчендайзер", label: "Мерчендайзер" },
  { value: "Супервайзер", label: "Супервайзер" },
  { value: "Экспедитор", label: "Экспедитор" }
];

/** Faqat shaxsga tegishli maydonlar — joy sozlamalari Рабочее место da. */
export type AgentsBulkEditFields = {
  position?: string;
  agent_type?: string;
};

type Props = {
  open: boolean;
  count: number;
  loading: boolean;
  positions: string[];
  onClose: () => void;
  onSave: (fields: AgentsBulkEditFields) => Promise<void>;
};

export function AgentsBulkEditDialog({
  open,
  count,
  loading,
  positions,
  onClose,
  onSave
}: Props) {
  const [position, setPosition] = useState("");
  const [agentType, setAgentType] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPosition("");
    setAgentType("");
    setError(null);
  }, [open]);

  const handleSave = async () => {
    const fields: AgentsBulkEditFields = {};
    if (position.trim()) fields.position = position.trim();
    if (agentType.trim()) fields.agent_type = agentType.trim();
    if (Object.keys(fields).length === 0) {
      setError("Выберите хотя бы одно поле (должность или тип агента)");
      return;
    }
    setError(null);
    await onSave(fields);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <AgentTemplateModalHeader
          title="Массовое редактирование"
          subtitle={`Выбрано агентов: ${count}. Склад/филиал/направление — в Рабочее место.`}
        />
        <div className="space-y-3 px-6 py-4">
          <AgentFormField label="Должность">
            <input
              list="bulk-agent-positions"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className={agentModalInputClass}
              placeholder="Не менять"
            />
            <datalist id="bulk-agent-positions">
              {positions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </AgentFormField>
          <AgentFormField label="Тип агента">
            <AgentFormSelect
              value={agentType}
              onChange={setAgentType}
              emptyLabel="Не менять"
              options={AGENT_TYPE_OPTIONS}
            />
          </AgentFormField>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
        <AgentTemplateModalFooter>
          <button type="button" className={agentModalBtnCancel} onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className={agentModalBtnPrimary}
            disabled={loading}
            onClick={() => void handleSave()}
          >
            {loading ? "Сохранение…" : "Сохранить"}
          </button>
        </AgentTemplateModalFooter>
      </DialogContent>
    </Dialog>
  );
}
