"use client";

import { formatSalesMoney, formatSalesPct } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { SalesProPanel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type { SalesProDetailView, SalesProUiModel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { ArrowUpRight } from "lucide-react";

type Props = {
  model: SalesProUiModel;
  monthLabel: string;
  onOpenDetail: (view: SalesProDetailView) => void;
};

export function SalesProKpiPanels({ model, monthLabel, onOpenDetail }: Props) {
  return (
    <div className="ops-grid" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
      <SalesProPanel className="kpi-card">
        <div className="panel-head">
          <div>
            <h2>По продажам</h2>
            <p>План и факт за {monthLabel.toLowerCase()}</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "sales" })}>
            Подробно <ArrowUpRight size={13} />
          </button>
        </div>
        <ul className="kpi-list">
          <li>
            <span>План</span>
            <b>{formatSalesMoney(model.plan)}</b>
          </li>
          <li>
            <span>Факт</span>
            <b>{formatSalesMoney(model.fact)}</b>
          </li>
          <li>
            <span>Выполнение</span>
            <b>{formatSalesPct(model.completionPct)}</b>
          </li>
          <li>
            <span>Средний чек</span>
            <b>{formatSalesMoney(model.averageTicket)}</b>
          </li>
        </ul>
      </SalesProPanel>

      <SalesProPanel className="kpi-card">
        <div className="panel-head">
          <div>
            <h2>ОКБ / АКБ</h2>
            <p>Активная клиентская база филиалов</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "okb" })}>
            Подробно <ArrowUpRight size={13} />
          </button>
        </div>
        <ul className="kpi-list">
          <li>
            <span>ОКБ</span>
            <b>{model.okb}</b>
          </li>
          <li>
            <span>АКБ</span>
            <b>{model.akb}</b>
          </li>
          <li>
            <span>Покрытие</span>
            <b>{formatSalesPct(model.coveragePct)}</b>
          </li>
          <li>
            <span>Заказы</span>
            <b>{model.ordersCount}</b>
          </li>
        </ul>
      </SalesProPanel>

      <SalesProPanel className="kpi-card">
        <div className="panel-head">
          <div>
            <h2>Планы KPI</h2>
            <p>Дополнительные показатели и их выполнение</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "allocation" })}>
            Все KPI <ArrowUpRight size={13} />
          </button>
        </div>
        <ul className="kpi-list">
          <li>
            <span>Доставлено</span>
            <b>{model.deliveredOrdersCount}</b>
          </li>
          <li>
            <span>Филиалов</span>
            <b>{model.branchRows.length}</b>
          </li>
          <li>
            <span>Направлений</span>
            <b>{model.directionRows.length}</b>
          </li>
          <li>
            <span>Супервайзеров</span>
            <b>{model.agentRows.length}</b>
          </li>
        </ul>
      </SalesProPanel>
    </div>
  );
}
