"use client";

import {
  formatSupervisorProMoney,
  formatSupervisorProPct
} from "@/components/dashboard/supervisor/pro/supervisor-pro-format";
import { SupervisorProPanel } from "@/components/dashboard/supervisor/pro/supervisor-pro-shared";
import type {
  SupervisorProDetailView,
  SupervisorProUiModel
} from "@/components/dashboard/supervisor/pro/supervisor-pro-types";
import { ArrowUpRight, Banknote } from "lucide-react";

export function SupervisorProPayments({
  model,
  activeId,
  onOpenDetail
}: {
  model: SupervisorProUiModel;
  activeId: string | null;
  onOpenDetail: (view: SupervisorProDetailView) => void;
}) {
  return (
    <SupervisorProPanel className="sv-methods">
      <div className="panel-head">
        <div>
          <h2>Продажи по способам оплаты</h2>
          <p>Факт в разрезе расчётных моделей</p>
        </div>
        <button
          type="button"
          className="text-link"
          onClick={() => onOpenDetail({ kind: "payment", id: activeId || "all" })}
        >
          Детали <ArrowUpRight size={13} />
        </button>
      </div>
      <div className="sv-method-grid">
        <button
          type="button"
          className={`sv-method-card total ${!activeId || activeId === "all" ? "active" : ""}`}
          onClick={() => onOpenDetail({ kind: "payment", id: "all" })}
        >
          <span>
            <Banknote size={14} /> Общая сумма
          </span>
          <b>{formatSupervisorProMoney(model.paymentTotal)} UZS</b>
          <div className="kpi-bar">
            <em style={{ width: "100%", background: "linear-gradient(90deg,#12bd95,#287cf4)" }} />
          </div>
          <small>
            все способы · {model.methodRows.length} модели
          </small>
        </button>
        {model.methodRows.map((method) => (
          <button
            type="button"
            key={method.id}
            className={`sv-method-card ${activeId === method.id ? "active" : ""}`}
            style={{ borderColor: `${method.color}55` }}
            onClick={() => onOpenDetail({ kind: "payment", id: method.id })}
          >
            <span className="sv-method-name">{method.name}</span>
            <b style={{ color: method.color }}>{formatSupervisorProMoney(method.amount)} UZS</b>
            <div className="kpi-bar">
              <em
                style={{
                  width: `${Math.min(100, method.sharePct)}%`,
                  background: method.color
                }}
              />
            </div>
            <small>доля {formatSupervisorProPct(method.sharePct)}</small>
          </button>
        ))}
        {model.methodRows.length === 0 ? (
          <div className="empty" style={{ minWidth: 0, gridColumn: "1 / -1" }}>
            Нет данных по способам оплаты за срез
          </div>
        ) : null}
      </div>
    </SupervisorProPanel>
  );
}
