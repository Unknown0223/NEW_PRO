"use client";

import { formatSalesMoney, formatSalesPct } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { downloadSalesProCsv, SalesProPanel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type {
  SalesProAgentRow,
  SalesProBranchRow,
  SalesProDetailView,
  SalesProDirectionRow,
  SalesProUiModel
} from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { ArrowUpRight, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  model: SalesProUiModel;
  onOpenDetail: (view: SalesProDetailView) => void;
};

type SortKey = "name" | "akb" | "plan" | "fact" | "completion";

type TableRow = {
  id: string;
  name: string;
  subtitle: string;
  akb: number;
  plan: number;
  fact: number;
  completion: number;
};

function toCompletion(value: number | null, plan: number, fact: number): number {
  if (value != null && Number.isFinite(value)) return value;
  if (plan > 0) return (fact / plan) * 100;
  return 0;
}

function SalesDataTable({
  rows,
  firstColumn,
  detailKind,
  onOpenDetail,
  exportName
}: {
  rows: TableRow[];
  firstColumn: string;
  detailKind: SalesProDetailView["kind"];
  onOpenDetail: (view: SalesProDetailView) => void;
  exportName: string;
}) {
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("fact");
  const [dir, setDir] = useState<1 | -1>(-1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => !q || row.name.toLowerCase().includes(q));
  }, [query, rows]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sort] - b[sort]) * dir;
    });
    return copy;
  }, [dir, filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const safePage = Math.min(page, pages);
  const visible = sorted.slice((safePage - 1) * size, safePage * size);
  const totals = filtered.reduce(
    (sum, row) => ({ plan: sum.plan + row.plan, fact: sum.fact + row.fact }),
    { plan: 0, fact: 0 }
  );
  const totalCompletion = totals.plan > 0 ? (totals.fact / totals.plan) * 100 : 0;

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(key === "name" ? 1 : -1);
    }
    setPage(1);
  };

  return (
    <>
      <div className="table-tools">
        <select
          value={size}
          onChange={(e) => {
            setSize(Number(e.target.value));
            setPage(1);
          }}
          aria-label="Строк на странице"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <label className="table-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Поиск по названию"
            aria-label="Поиск по таблице"
          />
        </label>
        <button
          type="button"
          className="icon-action"
          aria-label="Экспортировать таблицу"
          title="Экспорт CSV"
          onClick={() =>
            downloadSalesProCsv(exportName, [
              [firstColumn, "АКБ", "План", "Факт", "Выполнение, %"],
              ...filtered.map((r) => [
                r.name,
                r.akb,
                Math.round(r.plan),
                Math.round(r.fact),
                r.completion.toFixed(1)
              ])
            ])
          }
        >
          <Download size={16} />
        </button>
      </div>
      <div className="table-stats">
        <span>
          Выбрано <b>{filtered.length}</b>
        </span>
        <span>
          План <b>{formatSalesMoney(totals.plan)}</b>
        </span>
        <span>
          Факт <b>{formatSalesMoney(totals.fact)}</b>
        </span>
        <span>
          Выполнение{" "}
          <b style={{ color: totalCompletion >= 100 ? "#0aa783" : "#c68d16" }}>
            {formatSalesPct(totalCompletion)}
          </b>
        </span>
      </div>
      <div className="table-scroll">
        <div className="data-head">
          {(
            [
              ["name", firstColumn],
              ["akb", "АКБ"],
              ["plan", "План"],
              ["fact", "Факт"],
              ["completion", "Выполнение плана"]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={sort === key ? "sorted" : ""}
              onClick={() => toggleSort(key)}
            >
              {label}
              {key !== "name" ? " ↑↓" : ""}
            </button>
          ))}
        </div>
        {visible.map((row) => (
          <div
            className="data-row"
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetail({ kind: detailKind } as SalesProDetailView)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenDetail({ kind: detailKind } as SalesProDetailView);
              }
            }}
          >
            <span className="data-name">
              <b>{row.name}</b>
              <small>{row.subtitle}</small>
            </span>
            <span className="data-numeric">{row.akb}</span>
            <span className="data-numeric">{formatSalesMoney(row.plan)}</span>
            <span className="data-numeric">{formatSalesMoney(row.fact)}</span>
            <span className="data-progress-cell">
              <div className="kpi-bar">
                <em
                  style={{
                    width: `${Math.min(100, row.completion)}%`,
                    background:
                      row.completion >= 100
                        ? "#12bd95"
                        : row.completion >= 75
                          ? "#287cf4"
                          : row.completion >= 50
                            ? "#f7b62d"
                            : "#ff466e"
                  }}
                />
              </div>
              <b
                style={{
                  color:
                    row.completion >= 100
                      ? "#12bd95"
                      : row.completion >= 75
                        ? "#287cf4"
                        : row.completion >= 50
                          ? "#c68d16"
                          : "#e04a63"
                }}
              >
                {formatSalesPct(row.completion)}
              </b>
            </span>
          </div>
        ))}
        {visible.length === 0 ? <div className="empty">Записей не найдено. Измените поиск или фильтры.</div> : null}
      </div>
      <div className="pager">
        <span>{sorted.length} записей</span>
        <div className="pager-controls">
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
            Назад
          </button>
          <b>
            {safePage} / {pages}
          </b>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={safePage >= pages}
          >
            Вперёд
          </button>
        </div>
      </div>
    </>
  );
}

export function SalesProTables({ model, onOpenDetail }: Props) {
  const branchRows: TableRow[] = model.branchRows.map((r: SalesProBranchRow) => ({
    id: r.id,
    name: r.name.trim() || "Без филиала",
    subtitle: `ОКБ ${r.okb} · АКБ ${r.akb}`,
    akb: r.akb,
    plan: r.plan,
    fact: r.fact,
    completion: toCompletion(r.completion, r.plan, r.fact)
  }));

  const directionRows: TableRow[] = model.directionRows.map((r: SalesProDirectionRow) => ({
    id: r.id,
    name: r.name,
    subtitle: "Канал сбыта",
    akb: 0,
    plan: r.plan,
    fact: r.fact,
    completion: toCompletion(r.completion, r.plan, r.fact)
  }));

  const agentRows: TableRow[] = model.agentRows.map((r: SalesProAgentRow) => ({
    id: r.id,
    name: r.name.trim() || "Без супервайзера",
    subtitle: `Заказов: ${r.ordersCount}`,
    akb: r.akb,
    plan: r.plan,
    fact: r.fact,
    completion: toCompletion(r.completion, r.plan, r.fact)
  }));

  return (
    <div className="tables-stack">
      <SalesProPanel className="table-panel">
        <div className="panel-head table-head-row">
          <div>
            <h2>По филиалам</h2>
            <p>План, факт и выполнение</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "branches" })}>
            Все филиалы <ArrowUpRight size={13} />
          </button>
        </div>
        <SalesDataTable
          rows={branchRows}
          firstColumn="Филиал"
          detailKind="branches"
          onOpenDetail={onOpenDetail}
          exportName="salec-filialy.csv"
        />
      </SalesProPanel>

      <SalesProPanel className="table-panel">
        <div className="panel-head table-head-row">
          <div>
            <h2>По направлениям торговли</h2>
            <p>Каналы сбыта и их выполнение</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "directions" })}>
            Все направления <ArrowUpRight size={13} />
          </button>
        </div>
        <SalesDataTable
          rows={directionRows}
          firstColumn="Направление"
          detailKind="directions"
          onOpenDetail={onOpenDetail}
          exportName="salec-napravleniya.csv"
        />
      </SalesProPanel>

      <SalesProPanel className="table-panel">
        <div className="panel-head table-head-row">
          <div>
            <h2>По супервайзерам</h2>
            <p>План, факт и АКБ</p>
          </div>
          <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "agents" })}>
            Все <ArrowUpRight size={13} />
          </button>
        </div>
        <SalesDataTable
          rows={agentRows}
          firstColumn="Супервайзер"
          detailKind="agents"
          onOpenDetail={onOpenDetail}
          exportName="salec-supervayzery.csv"
        />
      </SalesProPanel>
    </div>
  );
}
