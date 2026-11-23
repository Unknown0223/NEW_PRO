"use client";

import {
  downloadSupervisorProCsv,
  formatSupervisorProMoney,
  formatSupervisorProNumber,
  formatSupervisorProPct
} from "@/components/dashboard/supervisor/pro/supervisor-pro-format";
import type {
  SupervisorProDetailView,
  SupervisorProUiModel
} from "@/components/dashboard/supervisor/pro/supervisor-pro-types";
import { supervisorProCatalogTabLabel } from "@/components/dashboard/supervisor/pro/supervisor-ui-model";
import { Building2, CreditCard, Download, Footprints, UserRound, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function SupervisorProDetailsDialog({
  view,
  model,
  onClose,
  onOpenPhotos
}: {
  view: SupervisorProDetailView;
  model: SupervisorProUiModel;
  onClose: () => void;
  onOpenPhotos?: (agentId: string) => void;
}) {
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(
      () => modalRef.current?.querySelector<HTMLElement>(".detail-close")?.focus(),
      0
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);

  const method =
    view.kind === "payment" && view.id !== "all"
      ? model.methodRows.find((row) => row.id === view.id)
      : null;
  const catalogRow =
    view.kind === "catalog"
      ? model.catalogByTab[view.tab].find((row) => row.id === view.id)
      : null;

  const title =
    view.kind === "payment" && method
      ? `Способ «${method.name}»`
      : view.kind === "payment"
        ? "Все способы оплаты"
        : view.kind === "catalog" && catalogRow
          ? catalogRow.name
          : "Визиты и отчёты по агентам";

  const exportDetail = () => {
    if (view.kind === "payment") {
      downloadSupervisorProCsv("salec-supervizor-oplata.csv", [
        ["Способ", "Сумма", "Доля, %"],
        ...model.methodRows.map((row) => [row.name, Math.round(row.amount), row.sharePct.toFixed(1)])
      ]);
      return;
    }
    if (view.kind === "visits") {
      downloadSupervisorProCsv("salec-supervizor-vizity.csv", [
        ["Супервайзер", "Агент", "План", "Факт", "Успешные", "GPS", "Фото", "%"],
        ...model.agentVisitRows.map((row) => [
          row.supervisor,
          row.name,
          row.plan,
          row.fact,
          row.success,
          row.gps,
          row.photos,
          row.completion.toFixed(1)
        ])
      ]);
      return;
    }
    if (catalogRow) {
      downloadSupervisorProCsv("salec-supervizor-detail.csv", [
        ["Показатель", "Значение"],
        ["Сумма", Math.round(catalogRow.amount)],
        ["Доля", catalogRow.pct.toFixed(1)],
        ["Объём", Math.round(catalogRow.volume)],
        ["АКБ", catalogRow.akb]
      ]);
    }
  };

  return (
    <div
      className="modal-backdrop detail-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className="detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sv-detail-title"
      >
        <header className="detail-header">
          <div className="detail-header-icon">
            {view.kind === "payment" ? (
              <CreditCard size={21} />
            ) : view.kind === "visits" ? (
              <Footprints size={21} />
            ) : (
              <Building2 size={21} />
            )}
          </div>
          <div className="detail-heading">
            <span className="detail-eyebrow">SALEC / ДАШБОРД СУПЕРВАЙЗЕРА</span>
            <h2 id="sv-detail-title">{title}</h2>
            <p>
              {view.kind === "payment"
                ? "Сравнение способов оплаты по срезу"
                : view.kind === "visits"
                  ? `План и факт визитной активности · ${model.agentVisitRows.length} агентов`
                  : `${supervisorProCatalogTabLabel(view.tab)} · срез ${model.dateLabel}`}
            </p>
          </div>
          <button type="button" className="icon-action detail-close" onClick={onClose} aria-label="Закрыть">
            <X size={19} />
          </button>
        </header>
        <div className="detail-body">
          {view.kind === "payment" ? (
            <>
              <div className="detail-metrics">
                <div>
                  <span>Факт</span>
                  <strong>{formatSupervisorProMoney(method?.amount ?? model.paymentTotal)} UZS</strong>
                </div>
                <div>
                  <span>Доля</span>
                  <strong>{formatSupervisorProPct(method?.sharePct ?? 100)}</strong>
                </div>
                <div>
                  <span>Способов</span>
                  <strong>{model.methodRows.length}</strong>
                </div>
                <div>
                  <span>Срез</span>
                  <strong>{model.dateLabel}</strong>
                </div>
              </div>
              <div className="detail-section-heading">
                <h3>Способы оплаты</h3>
                <span>Сравнение</span>
              </div>
              <div className="detail-category-list">
                {model.methodRows.map((row) => (
                  <div className="detail-category-row" key={row.id}>
                    <i style={{ background: row.color }} />
                    <div className="detail-category-name">
                      <b>{row.name}</b>
                      <div className="detail-progress">
                        <span style={{ background: row.color, width: `${Math.min(100, row.sharePct)}%` }} />
                      </div>
                    </div>
                    <strong>{formatSupervisorProMoney(row.amount)}</strong>
                    <span className="detail-percentage">{formatSupervisorProPct(row.sharePct)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {view.kind === "visits" ? (
            <>
              <div className="detail-metrics">
                <div>
                  <span>План визитов</span>
                  <strong>{formatSupervisorProNumber(model.statCards[0]?.plan ?? 0)}</strong>
                </div>
                <div>
                  <span>Факт</span>
                  <strong>{formatSupervisorProNumber(model.statCards[0]?.fact ?? 0)}</strong>
                </div>
                <div>
                  <span>Успешные</span>
                  <strong>{formatSupervisorProNumber(model.statCards[1]?.fact ?? 0)}</strong>
                </div>
                <div>
                  <span>Агентов</span>
                  <strong>{model.agentVisitRows.length}</strong>
                </div>
              </div>
              <div className="detail-section-heading">
                <h3>Визитная активность агентов</h3>
                <span>без выдуманных дневных графиков</span>
              </div>
              <div className="detail-visits-list">
                {model.agentVisitRows.map((row) => (
                  <div className="detail-visit-row" key={row.id}>
                    <i>
                      <UserRound size={15} />
                    </i>
                    <div className="detail-visit-name">
                      <b>{row.name}</b>
                      <small>{row.supervisor}</small>
                    </div>
                    <span>
                      план <b>{formatSupervisorProNumber(row.plan)}</b>
                    </span>
                    <span>
                      факт <b>{formatSupervisorProNumber(row.fact)}</b>
                    </span>
                    <span>
                      успех <b>{formatSupervisorProNumber(row.success)}</b>
                    </span>
                    <span>
                      GPS <b>{formatSupervisorProNumber(row.gps)}</b>
                    </span>
                    <span>
                      фото{" "}
                      {onOpenPhotos && row.photos > 0 ? (
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => onOpenPhotos(row.id)}
                        >
                          <b>{formatSupervisorProNumber(row.photos)}</b>
                        </button>
                      ) : (
                        <b>{formatSupervisorProNumber(row.photos)}</b>
                      )}
                    </span>
                    <div className="allocation-progress">
                      <div className="kpi-bar">
                        <em
                          style={{
                            width: `${Math.min(100, row.completion)}%`,
                            background:
                              row.completion >= 100 ? "#12bd95" : row.completion >= 75 ? "#287cf4" : "#f7b62d"
                          }}
                        />
                      </div>
                      <b style={{ color: row.completion >= 100 ? "#12bd95" : "#c68d16" }}>
                        {formatSupervisorProPct(row.completion)}
                      </b>
                    </div>
                  </div>
                ))}
                {model.agentVisitRows.length === 0 ? (
                  <div className="detail-empty">Нет агентов в срезе</div>
                ) : null}
              </div>
            </>
          ) : null}
          {view.kind === "catalog" && catalogRow ? (
            <>
              <div className="detail-metrics">
                <div>
                  <span>Сумма</span>
                  <strong>{formatSupervisorProMoney(catalogRow.amount)} UZS</strong>
                </div>
                <div>
                  <span>Доля</span>
                  <strong>{formatSupervisorProPct(catalogRow.pct)}</strong>
                </div>
                <div>
                  <span>Объём</span>
                  <strong>{formatSupervisorProNumber(catalogRow.volume)}</strong>
                </div>
                <div>
                  <span>АКБ</span>
                  <strong>{formatSupervisorProNumber(catalogRow.akb)}</strong>
                </div>
              </div>
              <div className="detail-section-heading">
                <h3>Все {supervisorProCatalogTabLabel(view.tab)}</h3>
                <span>Доля в факте</span>
              </div>
              <div className="detail-category-list">
                {model.catalogByTab[view.tab].map((row) => (
                  <div className="detail-category-row" key={row.id}>
                    <i style={{ background: row.color }} />
                    <div className="detail-category-name">
                      <b>{row.name}</b>
                      <div className="detail-progress">
                        <span style={{ background: row.color, width: `${Math.min(100, row.pct)}%` }} />
                      </div>
                    </div>
                    <strong>{formatSupervisorProMoney(row.amount)}</strong>
                    <span className="detail-percentage">{formatSupervisorProPct(row.pct)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <footer className="detail-footer">
          <span>Только реальные данные API · срез {model.dateLabel}</span>
          <div>
            <button type="button" className="secondary-button detail-footer-button" onClick={exportDetail}>
              <Download size={14} /> Экспорт
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
