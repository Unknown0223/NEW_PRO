"use client";

import {
  downloadSupervisorProCsv,
  formatSupervisorProMoney,
  formatSupervisorProNumber,
  formatSupervisorProPct
} from "@/components/dashboard/supervisor/pro/supervisor-pro-format";
import { SupervisorProPanel } from "@/components/dashboard/supervisor/pro/supervisor-pro-shared";
import type {
  SupervisorProCatalogTab,
  SupervisorProDetailView,
  SupervisorProUiModel
} from "@/components/dashboard/supervisor/pro/supervisor-pro-types";
import { Download, Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

export function SupervisorProCatalog({
  model,
  onOpenDetail
}: {
  model: SupervisorProUiModel;
  onOpenDetail: (view: SupervisorProDetailView) => void;
}) {
  const [tab, setTab] = useState<SupervisorProCatalogTab>("categories");
  const [query, setQuery] = useState("");

  const catalog = useMemo(() => {
    const rows = model.catalogByTab[tab];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [model.catalogByTab, tab, query]);

  const exportCatalog = () => {
    downloadSupervisorProCsv("salec-supervizor-katalog.csv", [
      ["Наименование", "Доля, %", "Сумма", "Объём", "Ср. чек", "АКБ"],
      ...catalog.map((row) => [
        row.name,
        row.pct.toFixed(1),
        Math.round(row.amount),
        Math.round(row.volume),
        Math.round(row.avgCheck),
        row.akb
      ])
    ]);
  };

  return (
    <SupervisorProPanel className="sv-catalog">
      <div className="panel-head sv-catalog-head">
        <div className="sv-catalog-title">
          <div className="sv-catalog-icon">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2>Ключевые показатели</h2>
            <p>Доля, сумма и АКБ по ассортименту</p>
          </div>
        </div>
        <div className="mini-segment sv-tabs">
          <button
            type="button"
            className={tab === "categories" ? "selected" : ""}
            onClick={() => setTab("categories")}
          >
            По категориям
          </button>
          <button
            type="button"
            className={tab === "groups" ? "selected" : ""}
            onClick={() => setTab("groups")}
          >
            По группам
          </button>
          <button
            type="button"
            className={tab === "brands" ? "selected" : ""}
            onClick={() => setTab("brands")}
          >
            По брендам
          </button>
        </div>
      </div>
      <div className="sv-catalog-toolbar">
        <label className="table-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск..."
            aria-label="Поиск по таблице"
          />
        </label>
        <button type="button" className="secondary-button" onClick={exportCatalog}>
          <Download size={14} /> Excel
        </button>
        <span className="sv-catalog-count">Всего: {catalog.length}</span>
      </div>
      <div className="table-scroll">
        <div className="sv-cat-head">
          <button type="button" onClick={() => setQuery("")}>
            Наименование
          </button>
          <button type="button">Доля</button>
          <button type="button">Сумма, UZS</button>
          <button type="button">Объём</button>
          <button type="button">Ср. чек</button>
          <button type="button">АКБ</button>
          <button type="button"> </button>
        </div>
        {catalog.map((row) => (
          <button
            type="button"
            className="sv-cat-row"
            key={`${tab}-${row.id}`}
            onClick={() => onOpenDetail({ kind: "catalog", tab, id: row.id })}
          >
            <span className="sv-cat-name">
              <i style={{ background: row.color }} />
              <b>{row.name}</b>
            </span>
            <span className="sv-cat-share">
              <div className="kpi-bar">
                <em style={{ width: `${Math.min(100, row.pct)}%`, background: row.color }} />
              </div>
              <b>{formatSupervisorProPct(row.pct)}</b>
            </span>
            <span className="sv-cat-numeric">{formatSupervisorProMoney(row.amount)}</span>
            <span className="sv-cat-numeric">{formatSupervisorProNumber(row.volume)}</span>
            <span className="sv-cat-numeric">{formatSupervisorProMoney(row.avgCheck)}</span>
            <span className="sv-cat-numeric">{formatSupervisorProNumber(row.akb)}</span>
            <span className="sv-cat-spark" aria-hidden />
          </button>
        ))}
        {catalog.length === 0 ? (
          <div className="empty">
            {query ? `По запросу «${query}» ничего не найдено` : "Нет данных ассортимента"}
          </div>
        ) : null}
      </div>
    </SupervisorProPanel>
  );
}
