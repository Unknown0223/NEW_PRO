"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AgentFormField,
  AgentFormSelect,
  AgentTemplateModalFooter,
  AgentTemplateModalHeader,
  agentModalBtnCancel,
  agentModalBtnPrimary
} from "@/components/staff/agent-workspace-template-ui";

const AGENT_TYPE_OPTIONS = [
  { value: "Торговый представитель", label: "Торговый представитель" },
  { value: "Мерчендайзер", label: "Мерчендайзер" },
  { value: "Супервайзер", label: "Супервайзер" },
  { value: "Экспедитор", label: "Экспедитор" }
];

/** Faqat shaxsga tegishli maydonlar — должность / app_access — Рабочее место da. */
export type AgentsBulkEditFields = {
  agent_type?: string;
};

type Props = {
  open: boolean;
  count: number;
  loading: boolean;
  tenantSlug: string;
  onClose: () => void;
  onSave: (fields: AgentsBulkEditFields) => Promise<void>;
};

export function AgentsBulkEditDialog({
  open,
  count,
  loading,
  onClose,
  onSave
}: Props) {
  const [agentType, setAgentType] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAgentType("");
    setError(null);
  }, [open]);

  const handleSave = async () => {
    const fields: AgentsBulkEditFields = {};
    if (agentType.trim()) fields.agent_type = agentType.trim();
    if (Object.keys(fields).length === 0) {
      setError("Выберите тип агента");
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
          subtitle={`Выбрано агентов: ${count}. Должность / доступ / сессии — в Рабочее место.`}
        />
        <div className="space-y-3 px-6 py-4">
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
          <button type="button" className={agentModalBtnCancel} onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button type="button" className={agentModalBtnPrimary} onClick={() => void handleSave()} disabled={loading}>
            {loading ? "…" : "Сохранить"}
          </button>
        </AgentTemplateModalFooter>
      </DialogContent>
    </Dialog>
  );
}
