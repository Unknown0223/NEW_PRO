"use client";

import { formatSalesMoney, formatSalesPct } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { SalesProPanel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type {
  SalesProAgentRow,
  SalesProBranchRow,
  SalesProDetailView,
  SalesProDirectionRow,
  SalesProUiModel
} from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { ArrowUpRight } from "lucide-react";

type Props = {
  model: SalesProUiModel;
  onOpenDetail: (view: SalesProDetailView) => void;
};

function SimpleTable<T extends { id: string; name: string }>({
  rows,
  columns,
  onRow
}: {
  rows: T[];
  columns: { key: string; label: string; render: (row: T) => string }[];
  onRow?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground" style={{ padding: "8px 4px" }}>Нет данных.</p>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRow ? () => onRow(row) : undefined}
              style={onRow ? { cursor: "pointer" } : undefined}
            >
              {columns.map((c) => (
                <td key={c.key}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SalesProTables({ model, onOpenDetail }: Props) {
  const branchCols = [
    { key: "name", label: "Филиал", render: (r: SalesProBranchRow) => r.name },
    { key: "plan", label: "План", render: (r: SalesProBranchRow) => formatSalesMoney(r.plan) },
    { key: "fact", label: "Факт", render: (r: SalesProBranchRow) => formatSalesMoney(r.fact) },
    { key: "pct", label: "%", render: (r: SalesProBranchRow) => formatSalesPct(r.completion) },
    { key: "akb", label: "АКБ", render: (r: SalesProBranchRow) => String(r.akb) }
  ];
  const dirCols = [
    { key: "name", label: "Направление", render: (r: SalesProDirectionRow) => r.name },
    { key: "fact", label: "Факт", render: (r: SalesProDirectionRow) => formatSalesMoney(r.fact) }
  ];
  const agentCols = [
    { key: "name", label: "Супервайзер", render: (r: SalesProAgentRow) => r.name },
    { key: "plan", label: "План", render: (r: SalesProAgentRow) => formatSalesMoney(r.plan) },
    { key: "fact", label: "Факт", render: (r: SalesProAgentRow) => formatSalesMoney(r.fact) },
    { key: "pct", label: "%", render: (r: SalesProAgentRow) => formatSalesPct(r.completion) },
    { key: "akb", label: "АКБ", render: (r: SalesProAgentRow) => String(r.akb) }
  ];

  return (
    <>
      <SalesProPanel>
        <div className="panel-head table-head-row">
          <div>
            <h2>По филиалам</h2>
            <p>План, факт и выполнение</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "branches" })}>
            Все филиалы <ArrowUpRight size={13} />
          </button>
        </div>
        <SimpleTable rows={model.branchRows} columns={branchCols} onRow={() => onOpenDetail({ kind: "branches" })} />
      </SalesProPanel>

      <SalesProPanel>
        <div className="panel-head table-head-row">
          <div>
            <h2>По направлениям торговли</h2>
            <p>Каналы сбыта</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "directions" })}>
            Все направления <ArrowUpRight size={13} />
          </button>
        </div>
        <SimpleTable
          rows={model.directionRows}
          columns={dirCols}
          onRow={() => onOpenDetail({ kind: "directions" })}
        />
      </SalesProPanel>

      <SalesProPanel>
        <div className="panel-head table-head-row">
          <div>
            <h2>По супервайзерам</h2>
            <p>План, факт и АКБ</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "agents" })}>
            Все <ArrowUpRight size={13} />
          </button>
        </div>
        <SimpleTable rows={model.agentRows} columns={agentCols} onRow={() => onOpenDetail({ kind: "agents" })} />
      </SalesProPanel>
    </>
  );
}
