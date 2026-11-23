"use client";

import {
  downloadSupervisorProCsv,
  formatSupervisorProNumber,
  formatSupervisorProPct
} from "@/components/dashboard/supervisor/pro/supervisor-pro-format";
import { SupervisorProPanel } from "@/components/dashboard/supervisor/pro/supervisor-pro-shared";
import type {
  SupervisorProDetailView,
  SupervisorProUiModel
} from "@/components/dashboard/supervisor/pro/supervisor-pro-types";
import { ArrowUpRight, Camera, Download } from "lucide-react";

export function SupervisorProVisits({
  model,
  onOpenDetail,
  onOpenPhotos
}: {
  model: SupervisorProUiModel;
  onOpenDetail: (view: SupervisorProDetailView) => void;
  onOpenPhotos: (agentId?: string) => void;
}) {
  const exportVisits = () => {
    downloadSupervisorProCsv("salec-supervizor-vizity.csv", [
      ["Супервайзер", "Агент", "План", "Факт", "Успешные", "GPS", "Фото", "Выполнение, %", "Продажи"],
      ...model.agentVisitRows.map((row) => [
        row.supervisor,
        row.name,
        row.plan,
        row.fact,
        row.success,
        row.gps,
        row.photos,
        row.completion.toFixed(1),
        Math.round(row.sales)
      ])
    ]);
  };

  return (
    <SupervisorProPanel className="sv-visits">
      <div className="panel-head">
        <div>
          <h2>Визиты и отчёты</h2>
          <p>Контроль работы полевых агентов</p>
        </div>
        <div className="sv-visits-actions">
          <span className="sv-live-note">фото: {model.photoPendingHint}</span>
          <button type="button" className="text-link" onClick={() => onOpenPhotos()}>
            <Camera size={13} /> Фото отчёты
          </button>
          <button
            type="button"
            className="icon-action"
            onClick={exportVisits}
            aria-label="Экспорт визитов"
            title="Экспорт CSV"
          >
            <Download size={16} />
          </button>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "visits" })}>
            По агентам <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
      <div className="sv-stat-grid">
        {model.statCards.map((card) => {
          const tone = card.pct >= 90 ? "good" : card.pct >= 70 ? "info" : "bad";
          const color = card.pct >= 90 ? "#12bd95" : card.pct >= 70 ? "#287cf4" : "#f7b62d";
          return (
            <button
              type="button"
              className={`sv-stat-card ${tone}`}
              key={card.id}
              onClick={() => {
                if (card.id === "photos") onOpenPhotos();
                else onOpenDetail({ kind: "visits" });
              }}
            >
              <span>{card.name}</span>
              <b style={{ color }}>{formatSupervisorProPct(card.pct)}</b>
              <div className="sv-stat-values">
                <span>
                  План <b>{formatSupervisorProNumber(card.plan)}</b>
                </span>
                <span>
                  Факт <b>{formatSupervisorProNumber(card.fact)}</b>
                </span>
              </div>
              <div className="kpi-bar">
                <em style={{ width: `${Math.min(100, card.pct)}%`, background: color }} />
              </div>
            </button>
          );
        })}
      </div>
    </SupervisorProPanel>
  );
}
