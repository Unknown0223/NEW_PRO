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
  const completion = model.completionPct ?? 0;
  const akbRate = model.coveragePct;
  const planGap = Math.max(0, model.plan - model.fact);

  return (
    <div className="kpi-grid">
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
        <div className="kpi-pair">
          <div className="kpi-box">
            <span>План</span>
            <b>{formatSalesMoney(model.plan)}</b>
          </div>
          <div className="kpi-box fact">
            <span>Факт</span>
            <b>{formatSalesMoney(model.fact)}</b>
          </div>
        </div>
        <div className="kpi-progress">
          <div className="kpi-progress-head">
            <span>Выполнение плана продаж</span>
            <b style={{ color: completion >= 100 ? "#12bd95" : "#f7b62d" }}>{formatSalesPct(model.completionPct)}</b>
          </div>
          <div className="kpi-bar">
            <em
              style={{
                width: `${Math.min(100, completion)}%`,
                background: completion >= 100 ? "#12bd95" : "#f7b62d"
              }}
            />
          </div>
          <small>
            {model.plan <= 0
              ? "План на месяц не задан"
              : completion >= 100
                ? "План месяца выполнен"
                : `До плана осталось ${formatSalesMoney(planGap)}`}
          </small>
        </div>
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
        <div className="kpi-pair">
          <div className="kpi-box">
            <span>ОКБ</span>
            <b>{model.okb}</b>
          </div>
          <div className="kpi-box purple">
            <span>АКБ</span>
            <b>{model.akb}</b>
          </div>
        </div>
        <div className="kpi-progress">
          <div className="kpi-progress-head">
            <span>АКБ в процентах</span>
            <b>{formatSalesPct(akbRate)}</b>
          </div>
          <div className="kpi-bar">
            <em style={{ width: `${Math.min(100, akbRate)}%`, background: "#9147ed" }} />
          </div>
          <small>Покрытие активной базы · заказов: {model.ordersCount}</small>
        </div>
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
        <div className="kpi-chip-grid">
          <div className="kpi-chip">
            <span>Доставлено</span>
            <b>{model.deliveredOrdersCount}</b>
            <small>из {model.ordersCount} заказов</small>
            <div className="kpi-bar">
              <em
                style={{
                  width: `${Math.min(
                    100,
                    model.ordersCount > 0 ? (model.deliveredOrdersCount / model.ordersCount) * 100 : 0
                  )}%`,
                  background: "#12bd95"
                }}
              />
            </div>
          </div>
          <div className="kpi-chip">
            <span>Филиалы</span>
            <b>{model.branchRows.length}</b>
            <small>в выборке</small>
            <div className="kpi-bar">
              <em style={{ width: model.branchRows.length ? "100%" : "0%", background: "#287cf4" }} />
            </div>
          </div>
          <div className="kpi-chip">
            <span>Направления</span>
            <b>{model.directionRows.length}</b>
            <small>каналы сбыта</small>
            <div className="kpi-bar">
              <em style={{ width: model.directionRows.length ? "100%" : "0%", background: "#9147ed" }} />
            </div>
          </div>
          <div className="kpi-chip">
            <span>Средний чек</span>
            <b>{formatSalesMoney(model.averageTicket)}</b>
            <small>по факту продаж</small>
            <div className="kpi-bar">
              <em style={{ width: model.averageTicket > 0 ? "100%" : "0%", background: "#f7b62d" }} />
            </div>
          </div>
        </div>
      </SalesProPanel>
    </div>
  );
}
