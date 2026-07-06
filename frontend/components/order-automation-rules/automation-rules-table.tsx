"use client";

import {
  AutomationBadge,
  AutomationBadgeListCompact,
  ReadOnlyText
} from "@/components/order-automation-rules/automation-badge";
import {
  consignmentLabel,
  executionTypeLabel,
  formatAmount,
  sourceChannelLabel
} from "@/components/order-automation-rules/automation-display";
import type { AutomationRuleRow } from "@/components/order-automation-rules/order-automation-types";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  MoreVertical,
  Pencil,
  Trash2
} from "lucide-react";
import { useMemo, useState } from "react";

type TabKind = "restrictions" | "auto-confirm";

type Col = { key: string | null; label: string; width?: string };

const RESTRICTION_COLS: Col[] = [
  { key: "name", label: "Названия", width: "180px" },
  { key: "created_at", label: "Дата создания", width: "130px" },
  { key: "updated_at", label: "Дата последнего изменения", width: "150px" },
  { key: "consignment_mode", label: "Консигнация", width: "100px" },
  { key: "currency_code", label: "Валюта", width: "80px" },
  { key: "amount_from", label: "Сумма от", width: "100px" },
  { key: "amount_to", label: "Сумма до", width: "100px" },
  { key: "agent_name", label: "Агент", width: "120px" },
  { key: "warehouse_names", label: "Склады", width: "120px" },
  { key: "payment_method_ref", label: "Способ оплаты", width: "120px" },
  { key: "trade_direction_refs", label: "Направление торговли", width: "140px" },
  { key: "territory_refs", label: "Территории", width: "140px" },
  { key: "created_by", label: "Кто создал", width: "130px" },
  { key: "updated_by", label: "Кто изменил", width: "130px" },
  { key: "comment", label: "Комментарий", width: "160px" },
  { key: null, label: "", width: "60px" }
];

const CELL = "px-4 py-2 first:pl-5";
const CELL_TOP = `${CELL} align-top`;
const TH = "cursor-pointer select-none px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 first:pl-5";

const AUTO_CONFIRM_COLS: Col[] = [
  { key: "name", label: "Названия", width: "160px" },
  { key: "created_at", label: "Дата создания", width: "90px" },
  { key: "updated_at", label: "Дата последнего изменения", width: "90px" },
  { key: "execution_type", label: "Тип выполнения", width: "120px" },
  { key: "execution_time", label: "Точное время", width: "90px" },
  { key: "n_value", label: "Значение N", width: "80px" },
  { key: "consignment_mode", label: "Консигнация", width: "90px" },
  { key: "currency_code", label: "Валюта", width: "60px" },
  { key: "amount_from", label: "Сумма от", width: "80px" },
  { key: "amount_to", label: "Сумма до", width: "80px" },
  { key: "agent_name", label: "Агент", width: "100px" },
  { key: "warehouse_names", label: "Склад", width: "120px" },
  { key: "payment_method_ref", label: "Способ оплаты", width: "100px" },
  { key: "trade_direction_refs", label: "Направление торговли", width: "120px" },
  { key: "request_type_refs", label: "Тип заявки", width: "120px" },
  { key: "source_channels", label: "Источник заявки", width: "120px" },
  { key: "territory_refs", label: "Территория", width: "120px" },
  { key: "created_by", label: "Кто создал", width: "100px" },
  { key: "updated_by", label: "Кто изменил", width: "100px" },
  { key: "comment", label: "Комментарий", width: "140px" },
  { key: null, label: "", width: "60px" }
];

function cellValue(row: AutomationRuleRow, key: string): string | number | null | string[] {
  return (row as Record<string, unknown>)[key] as string | number | null | string[];
}

function refLabel(map: Map<string, string>, code: string | null | undefined): string {
  if (!code?.trim()) return "—";
  const c = code.trim();
  return map.get(c) ?? c;
}

export function AutomationRulesTable({
  tab,
  rows,
  refLabelByCode,
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate
}: {
  tab: TabKind;
  rows: AutomationRuleRow[];
  refLabelByCode: Map<string, string>;
  onEdit: (row: AutomationRuleRow) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, active: boolean) => void;
  onDuplicate: (id: number) => void;
}) {
  const columns = tab === "restrictions" ? RESTRICTION_COLS : AUTO_CONFIRM_COLS;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = cellValue(a, sortKey);
      const bv = cellValue(b, sortKey);
      if (av == null) return 1;
      if (bv == null) return -1;
      const as = Array.isArray(av) ? av.join(",") : String(av);
      const bs = Array.isArray(bv) ? bv.join(",") : String(bv);
      const c = as.localeCompare(bs, "ru");
      return sortDir === "asc" ? c : -c;
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: string | null) => {
    if (!key) return;
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.label || "actions"}
                style={{ width: col.width, minWidth: col.width }}
                className={TH}
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.key && sortKey === col.key ? (
                    sortDir === "asc" ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row) => (
            <tr
              key={row.id}
              className={`transition-colors hover:bg-muted ${!row.is_active ? "bg-muted/50" : ""}`}
            >
              <td className={CELL}>
                <ReadOnlyText>{row.name}</ReadOnlyText>
              </td>
              <td className={`whitespace-nowrap text-xs text-gray-500 ${CELL}`}>{row.created_at}</td>
              <td className={`whitespace-nowrap text-xs text-gray-500 ${CELL}`}>{row.updated_at}</td>
              {tab === "auto-confirm" ? (
                <>
                  <td className={CELL}>
                    <AutomationBadge value={executionTypeLabel(row.execution_type)} />
                  </td>
                  <td className={CELL}>
                    <ReadOnlyText>
                      {row.execution_type === "exact_time" || row.execution_type === "business_days_n"
                        ? row.execution_time?.slice(0, 5) ?? "—"
                        : "—"}
                    </ReadOnlyText>
                  </td>
                  <td className={CELL}>
                    <ReadOnlyText>
                      {row.execution_type === "business_days_n" && row.n_value != null
                        ? row.n_value
                        : "—"}
                    </ReadOnlyText>
                  </td>
                </>
              ) : null}
              <td className={CELL}>
                <AutomationBadge value={consignmentLabel(row.consignment_mode)} />
              </td>
              <td className={CELL}>
                <AutomationBadge value={refLabel(refLabelByCode, row.currency_code)} />
              </td>
              <td className={CELL}>
                <ReadOnlyText>
                  {row.amount_from != null ? formatAmount(row.amount_from) : "—"}
                </ReadOnlyText>
              </td>
              <td className={CELL}>
                <ReadOnlyText>{row.amount_to != null ? formatAmount(row.amount_to) : "—"}</ReadOnlyText>
              </td>
              <td className={CELL}>
                <ReadOnlyText link={Boolean(row.agent_name)}>{row.agent_name ?? "—"}</ReadOnlyText>
              </td>
              <td className={`max-w-[120px] ${CELL_TOP}`}>
                {row.warehouse_names.length > 1 ? (
                  <AutomationBadgeListCompact values={row.warehouse_names} maxVisible={1} />
                ) : (
                  <ReadOnlyText link={row.warehouse_names.length > 0}>
                    {row.warehouse_names[0] ?? "—"}
                  </ReadOnlyText>
                )}
              </td>
              <td className={CELL}>
                {row.payment_method_ref ? (
                  <AutomationBadge value={refLabel(refLabelByCode, row.payment_method_ref)} />
                ) : (
                  <ReadOnlyText>—</ReadOnlyText>
                )}
              </td>
              <td className={`max-w-[140px] ${CELL_TOP}`}>
                <AutomationBadgeListCompact
                  values={
                    row.trade_direction_refs?.length
                      ? row.trade_direction_refs
                      : row.trade_direction_ref
                        ? [row.trade_direction_ref]
                        : []
                  }
                />
              </td>
              {tab === "auto-confirm" ? (
                <>
                  <td className={`max-w-[120px] ${CELL_TOP}`}>
                    <AutomationBadgeListCompact values={row.request_type_refs ?? []} />
                  </td>
                  <td className={`max-w-[120px] ${CELL_TOP}`}>
                    <AutomationBadgeListCompact
                      values={row.source_channels ?? []}
                      mapLabel={sourceChannelLabel}
                    />
                  </td>
                </>
              ) : null}
              <td className={`max-w-[140px] ${CELL_TOP}`}>
                <AutomationBadgeListCompact values={row.territory_refs} />
              </td>
              <td className={CELL}>
                <ReadOnlyText link={Boolean(row.created_by)}>{row.created_by ?? "—"}</ReadOnlyText>
              </td>
              <td className={CELL}>
                <ReadOnlyText link={Boolean(row.updated_by)}>{row.updated_by ?? "—"}</ReadOnlyText>
              </td>
              <td className={`max-w-[160px] ${CELL}`}>
                <ReadOnlyText>{row.comment || "—"}</ReadOnlyText>
              </td>
              <td className={CELL}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="rounded p-1 text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                    title="Редактировать"
                  >
                    <Pencil size={14} />
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                      className="rounded p-1 text-gray-400 transition-colors hover:bg-muted hover:text-gray-600"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {openMenuId === row.id ? (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              onToggleActive(row.id, !row.is_active);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${row.is_active ? "bg-red-400" : "bg-emerald-400"}`}
                            />
                            {row.is_active ? "Деактивировать" : "Активировать"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDuplicate(row.id);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <Copy size={14} />
                            Дублировать
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(row.id);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Удалить
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
