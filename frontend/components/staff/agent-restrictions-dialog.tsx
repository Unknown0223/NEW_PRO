"use client";

import Link from "next/link";
import {
  AgentTemplateModal,
  agentModalBtnCancelTemplate
} from "@/components/staff/agent-workspace-template-ui";

export type AgentEntitlementSavePayload = {
  price_types: string[];
  product_rules: Array<{ category_id: number; all: boolean; product_ids?: number[] }>;
};

type Props = {
  open: boolean;
  agent: { fio: string; work_slot_id?: number | null } | null;
  bulkMode?: boolean;
  bulkCount?: number;
  bulkLabel?: string;
  onClose: () => void;
  /** @deprecated Workplace restrictions live on work-slots only */
  tenantSlug?: string;
  categories?: unknown[];
  categoriesLoading?: boolean;
  priceTypes?: string[];
  priceTypeLabels?: Record<string, string>;
  /** @deprecated No-op — redirects to work-slots */
  onSave?: (ent: AgentEntitlementSavePayload) => Promise<unknown>;
};

/** Типы цен и продуктовые ограничения перенесены на рабочее место. */
export function AgentRestrictionsDialog({
  open,
  agent,
  bulkMode = false,
  bulkCount = 0,
  bulkLabel,
  onClose
}: Props) {
  if (!open) return null;
  if (!bulkMode && !agent) return null;

  const chipCount = bulkMode ? bulkCount : 1;
  const chipLabel = bulkMode
    ? (bulkLabel ?? `Выбрано агентов: ${bulkCount}`)
    : (agent?.fio ?? "");
  const slotHref =
    !bulkMode && agent?.work_slot_id != null
      ? `/work-slots/${agent.work_slot_id}`
      : "/work-slots";

  return (
    <AgentTemplateModal title="Ограничения" onClose={onClose} width="max-w-lg">
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-emerald-50/60 px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm text-white shadow-sm">
          {chipCount > 1 ? chipCount : "👤"}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-teal-600">
            {chipCount > 1 ? "Агенты" : "Агент"}
          </p>
          <p className="truncate text-sm font-semibold text-slate-800">{chipLabel}</p>
        </div>
      </div>

      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Типы цен, ограничения по продуктам, склад, филиал и территория привязаны к{" "}
          <strong>рабочему месту</strong>, а не к сотруднику. При смене агента на месте настройки
          остаются на слоте.
        </p>
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Откройте{" "}
          <Link href={slotHref} className="font-semibold text-teal-700 underline">
            Рабочее место
          </Link>{" "}
          → «Конфигурация места» и задайте типы цен, entitlements и прочие параметры места.
        </p>
        {bulkMode ? (
          <p className="text-xs text-muted-foreground">
            Массовое редактирование ограничений по агентам больше недоступно — настройте каждое место
            отдельно или используйте массовые операции в списке рабочих мест.
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <button type="button" onClick={onClose} className={agentModalBtnCancelTemplate}>
          Закрыть
        </button>
      </div>
    </AgentTemplateModal>
  );
}
