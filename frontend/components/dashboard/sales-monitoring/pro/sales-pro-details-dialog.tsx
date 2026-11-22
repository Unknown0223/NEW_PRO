"use client";

import { createPortal } from "react-dom";
import { formatSalesMoney, formatSalesPct } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { downloadSalesProCsv } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type { SalesProDetailView, SalesProUiModel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { Download, X } from "lucide-react";

type Props = {
  view: SalesProDetailView;
  model: SalesProUiModel;
  monthLabel: string;
  onClose: () => void;
};

const TITLES: Record<SalesProDetailView["kind"], string> = {
  plan: "План продаж",
  sales: "Факт продаж",
  okb: "ОКБ / АКБ",
  categories: "Категории продаж",
  branches: "Филиалы",
  directions: "Направления торговли",
  agents: "Супервайзеры",
  dynamics: "Динамика плана и факта",
  allocation: "Распределение плана"
};

export function SalesProDetailsDialog({ view, model, monthLabel, onClose }: Props) {
  if (typeof document === "undefined") return null;

  const rows = detailRows(view, model);
  const title = TITLES[view.kind];

  return createPortal(
    <div className="sales-pro" style={{ position: "fixed", inset: 0, zIndex: 500 }}>
      <div
        role="presentation"
        style={{ position: "absolute", inset: 0, background: "rgba(16,43,94,.45)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel"
        style={{
          position: "relative",
          zIndex: 1,
          margin: "5vh auto",
          width: "min(920px, 94vw)",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 18
        }}
      >
        <div className="panel-head table-head-row">
          <div>
            <h2>{title}</h2>
            <p>{monthLabel}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="icon-action"
              title="Экспорт CSV"
              aria-label="Экспорт CSV"
              onClick={() => downloadSalesProCsv(`sales-${view.kind}.csv`, rows)}
            >
              <Download size={16} />
            </button>
            <button type="button" className="icon-action" onClick={onClose} aria-label="Закрыть" title="Закрыть">
              <X size={16} />
            </button>
          </div>
        </div>
        {rows.length <= 1 ? (
          <p className="text-sm text-muted-foreground">Нет данных для отображения.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {rows[0]!.map((h) => (
                    <th key={String(h)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function detailRows(view: SalesProDetailView, model: SalesProUiModel): (string | number)[][] {
  switch (view.kind) {
    case "plan":
      return [
        ["Показатель", "Значение"],
        ["План", formatSalesMoney(model.plan)],
        ["Примечание", model.planNote || "—"]
      ];
    case "sales":
      return [
        ["Показатель", "Значение"],
        ["Факт", formatSalesMoney(model.fact)],
        ["Выполнение", formatSalesPct(model.completionPct)],
        ["Средний чек", formatSalesMoney(model.averageTicket)]
      ];
    case "okb":
      return [
        ["Показатель", "Значение"],
        ["ОКБ", model.okb],
        ["АКБ", model.akb],
        ["Покрытие", formatSalesPct(model.coveragePct)]
      ];
    case "categories":
      return [
        ["Категория", "Сумма", "Доля %"],
        ...model.categoryRows.map((r) => [r.name, formatSalesMoney(r.amount), r.pct.toFixed(1)])
      ];
    case "branches":
      return [
        ["Филиал", "План", "Факт", "%", "АКБ"],
        ...model.branchRows.map((r) => [
          r.name,
          formatSalesMoney(r.plan),
          formatSalesMoney(r.fact),
          formatSalesPct(r.completion),
          r.akb
        ])
      ];
    case "directions":
      return [
        ["Направление", "Факт"],
        ...model.directionRows.map((r) => [r.name, formatSalesMoney(r.fact)])
      ];
    case "agents":
      return [
        ["Супервайзер", "План", "Факт", "%", "АКБ"],
        ...model.agentRows.map((r) => [
          r.name,
          formatSalesMoney(r.plan),
          formatSalesMoney(r.fact),
          formatSalesPct(r.completion),
          r.akb
        ])
      ];
    case "dynamics":
      return [
        ["День", "План", "Факт", "%"],
        ...model.days.map((d) => [
          d.label,
          Math.round(d.plan),
          Math.round(d.fact),
          d.completion.toFixed(1)
        ])
      ];
    case "allocation":
      return [
        ["Разрез", "План", "Факт", "%"],
        ...model.branchRows.map((r) => [
          r.name,
          formatSalesMoney(r.plan),
          formatSalesMoney(r.fact),
          formatSalesPct(r.completion)
        ]),
        ...model.agentRows.map((r) => [
          r.name,
          formatSalesMoney(r.plan),
          formatSalesMoney(r.fact),
          formatSalesPct(r.completion)
        ])
      ];
    default:
      return [["—"]];
  }
}
