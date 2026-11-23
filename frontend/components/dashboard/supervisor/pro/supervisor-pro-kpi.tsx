"use client";

import {
  formatSupervisorProMoney,
  formatSupervisorProPct
} from "@/components/dashboard/supervisor/pro/supervisor-pro-format";
import { SupervisorProPanel } from "@/components/dashboard/supervisor/pro/supervisor-pro-shared";
import type { SupervisorProUiModel } from "@/components/dashboard/supervisor/pro/supervisor-pro-types";
import { Footprints } from "lucide-react";

export function SupervisorProKpiPanel({ model }: { model: SupervisorProUiModel }) {
  const completion = model.completionPct ?? 0;
  const completionColor =
    model.completionPct == null
      ? "#8498b7"
      : completion >= 100
        ? "#12bd95"
        : completion >= model.monthProgressPct
          ? "#287cf4"
          : "#f7b62d";

  return (
    <SupervisorProPanel className="sv-kpi-panel">
      <div className="panel-head">
        <div>
          <h2>KPI план продаж (месяц)</h2>
          <p>Одобренный план, факт MTD и прогноз · срез {model.dateLabel}</p>
        </div>
        <span className="sv-kpi-badge">
          {model.forecastTrendUp ? "Тренд к перевыполнению" : "Тренд к плану"}
        </span>
      </div>
      <div className="sv-kpi-grid">
        <div className="sv-kpi-card">
          <span>План (одобр.)</span>
          <b>{formatSupervisorProMoney(model.planApproved)} UZS</b>
          <small>на месяц · {model.agentCount} агентов</small>
        </div>
        <div className="sv-kpi-card warn">
          <span>План (на согл.)</span>
          <b>{model.planPending == null ? "—" : `${formatSupervisorProMoney(model.planPending)} UZS`}</b>
          <small>в API отдельного поля нет</small>
        </div>
        <div className="sv-kpi-card accent">
          <span>Факт MTD</span>
          <b>{formatSupervisorProMoney(model.mtdFact)} UZS</b>
          <small>с начала месяца по срез</small>
        </div>
        <div className="sv-kpi-card">
          <span>Выполнение</span>
          <b style={{ color: completionColor }}>
            {model.completionPct == null ? "—" : formatSupervisorProPct(model.completionPct)}
          </b>
          <div className="kpi-bar">
            <em
              style={{
                width: `${Math.min(100, completion)}%`,
                background: completionColor
              }}
            />
          </div>
          <small>прогресс месяца {formatSupervisorProPct(model.monthProgressPct)}</small>
        </div>
        <div className="sv-kpi-card">
          <span>Средний чек</span>
          <b>{formatSupervisorProMoney(model.averageTicket)} UZS</b>
          <small>факт / визиты</small>
        </div>
        <div className="sv-kpi-card warn">
          <span>Нужно в день</span>
          <b>{formatSupervisorProMoney(model.neededPerDay)} UZS</b>
          <small>
            <Footprints size={10} style={{ display: "inline", marginRight: 4 }} />
            {model.daysLeft} дней до конца месяца
          </small>
        </div>
      </div>
    </SupervisorProPanel>
  );
}
