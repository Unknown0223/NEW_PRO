"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Agent, AgentListResponse } from "@/lib/types";
import {
  BRANCHES,
  POSITIONS,
  TRADE_DIRECTIONS,
  WAREHOUSES,
} from "@/lib/dictionaries";
import {
  AgentFormModal,
  BulkEditModal,
  ConfirmDialog,
  RestrictionsModal,
  SessionsModal,
} from "./AgentModals";

/* ---------- small ui bits ---------- */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? "bg-teal-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Badge({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] ${
        accent
          ? "border-teal-200 bg-teal-50 text-teal-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function syncColor(lastSync: string | null): string {
  if (!lastSync) return "bg-slate-300";
  const hours = (Date.now() - new Date(lastSync).getTime()) / 3600_000;
  if (hours <= 1) return "bg-emerald-500";
  if (hours <= 24) return "bg-amber-400";
  return "bg-red-500";
}

function fmtDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return `${d.toLocaleDateString("ru-RU")} ${d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
}

const selectCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-teal-500";

/* ---------- main ---------- */
export default function AgentsClient() {
  // filters (draft -> applied on button)
  const [draft, setDraft] = useState({
    branch: "",
    tradeDirection: "",
    position: "",
    warehouse: "",
  });
  const [applied, setApplied] = useState(draft);

  const [activeTab, setActiveTab] = useState<"true" | "false">("true");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [resp, setResp] = useState<AgentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);

  // modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [restrictionsTarget, setRestrictionsTarget] = useState<{
    ids: number[];
    label: string;
    priceTypes: string[];
    products: string[];
  } | null>(null);
  const [sessionsAgent, setSessionsAgent] = useState<Agent | null>(null);
  const [confirmAgent, setConfirmAgent] = useState<Agent | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<"activate" | "deactivate" | "clear-sessions" | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("active", activeTab);
    if (applied.branch) p.set("branch", applied.branch);
    if (applied.tradeDirection) p.set("tradeDirection", applied.tradeDirection);
    if (applied.position) p.set("position", applied.position);
    if (applied.warehouse) p.set("warehouse", applied.warehouse);
    if (debounced.trim()) p.set("search", debounced.trim());
    p.set("page", String(page));
    p.set("limit", String(limit));
    p.set("sortDir", sortDir);
    return p.toString();
  }, [activeTab, applied, debounced, page, limit, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents?${queryString}`);
      const json: AgentListResponse = await res.json();
      setResp(json);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelected([]);
  }, [queryString]);

  const agents = resp?.data ?? [];
  const total = resp?.total ?? 0;
  const pages = resp?.pages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const patchAgent = async (id: number, body: Record<string, unknown>) => {
    const res = await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated: Agent = await res.json();
      setResp((r) =>
        r
          ? { ...r, data: r.data.map((a) => (a.id === id ? updated : a)) }
          : r
      );
      return updated;
    }
    return null;
  };

  const allAccessOn = useMemo(() => {
    const sel = agents.filter((a) => selected.includes(a.id));
    return sel.length > 0 && sel.every((a) => a.appAccess);
  }, [agents, selected]);

  const bulkAction = async (action: string) => {
    if (selected.length === 0) return;
    setBulkBusy(true);
    try {
      await fetch("/api/agents/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, action }),
      });
      await load();
      if (action === "activate" || action === "deactivate") setSelected([]);
    } finally {
      setBulkBusy(false);
    }
  };

  const exportUrl = useMemo(() => {
    const p = new URLSearchParams(queryString);
    p.delete("page");
    p.delete("limit");
    p.delete("sortDir");
    return `/api/agents/export?${p.toString()}`;
  }, [queryString]);

  const pageNumbers = useMemo(() => {
    const nums: (number | "...")[] = [];
    if (pages <= 6) {
      for (let i = 1; i <= pages; i++) nums.push(i);
    } else {
      nums.push(1, 2);
      if (page > 3 && page < pages - 1) nums.push("...", page, "...");
      else nums.push("...");
      nums.push(pages);
    }
    return nums;
  }, [page, pages]);

  return (
    <div className="min-h-screen flex-1 bg-slate-100">
      {/* Topbar */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2.5">
        <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500">
          <span className="text-teal-600">◎</span> GPS
        </span>
        <span className="text-sm text-slate-500">Нет избранные страницы</span>
        <div className="ml-auto h-8 w-8 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-center text-sm leading-8 text-white">
          A
        </div>
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Агент</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
            >
              Добавить агента
            </button>
            <button className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-500 hover:bg-slate-50">
              ⏷
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-44">
            <select
              className={selectCls}
              value={draft.branch}
              onChange={(e) => setDraft((d) => ({ ...d, branch: e.target.value }))}
            >
              <option value="">Филиалы</option>
              {BRANCHES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="w-48">
            <select
              className={selectCls}
              value={draft.tradeDirection}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tradeDirection: e.target.value }))
              }
            >
              <option value="">Направление торговли</option>
              {TRADE_DIRECTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <select
              className={selectCls}
              value={draft.position}
              onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}
            >
              <option value="">Должность</option>
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <select
              className={selectCls}
              value={draft.warehouse}
              onChange={(e) => setDraft((d) => ({ ...d, warehouse: e.target.value }))}
            >
              <option value="">Склад</option>
              {WAREHOUSES.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                const cleared = {
                  branch: "",
                  tradeDirection: "",
                  position: "",
                  warehouse: "",
                };
                setDraft(cleared);
                setApplied(cleared);
                setPage(1);
              }}
              title="Сбросить фильтры"
              className="rounded-lg bg-teal-600/80 px-3 py-2 text-white hover:bg-teal-700"
            >
              ⌫
            </button>
            <button
              onClick={() => {
                setApplied(draft);
                setPage(1);
              }}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
            >
              Применить
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(
            [
              ["true", "Активный"],
              ["false", "Не активный"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => {
                setActiveTab(val);
                setPage(1);
              }}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                activeTab === val
                  ? "bg-white text-teal-700 border border-b-0 border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-xl rounded-tl-none border border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <button
              onClick={() => setSortDir((s) => (s === "asc" ? "desc" : "asc"))}
              title="Сортировка"
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-slate-500 hover:bg-slate-50"
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-600 outline-none"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="relative w-64">
              <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <a
              href={exportUrl}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <span className="text-emerald-600">📗</span> Excel
            </a>
            <button
              onClick={load}
              title="Обновить"
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-teal-600 hover:bg-slate-50"
            >
              ⟳
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[2300px] text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                <tr>
                  <th className="w-9 px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-600"
                      checked={selected.length === agents.length && agents.length > 0}
                      onChange={(e) =>
                        setSelected(e.target.checked ? agents.map((a) => a.id) : [])
                      }
                    />
                  </th>
                  <th
                    className="min-w-[220px] cursor-pointer px-3 py-3 font-medium"
                    onClick={() => setSortDir((s) => (s === "asc" ? "desc" : "asc"))}
                  >
                    Ф.И.О {sortDir === "asc" ? "▲" : "▼"}
                  </th>
                  <th className="px-3 py-3 font-medium">Продукт</th>
                  <th className="px-3 py-3 font-medium">Тип агента</th>
                  <th className="px-3 py-3 font-medium">Код</th>
                  <th className="px-3 py-3 font-medium">ПИНФЛ</th>
                  <th className="px-3 py-3 font-medium">Консигнация</th>
                  <th className="px-3 py-3 font-medium">Версия APK</th>
                  <th className="px-3 py-3 font-medium">Название устройства</th>
                  <th className="px-3 py-3 font-medium">Последняя синхронизация</th>
                  <th className="px-3 py-3 font-medium">Телефон</th>
                  <th className="px-3 py-3 font-medium">Авторизоваться</th>
                  <th className="px-3 py-3 font-medium">Тип цены</th>
                  <th className="px-3 py-3 font-medium">Склад</th>
                  <th className="px-3 py-3 font-medium">Направление торговли</th>
                  <th className="px-3 py-3 font-medium">Филиал</th>
                  <th className="px-3 py-3 font-medium">Должность</th>
                  <th className="px-3 py-3 font-medium">Дата создания</th>
                  <th className="px-3 py-3 font-medium">Кол-во активных сессий</th>
                  <th className="px-3 py-3 font-medium">Макс. кол-во сессий</th>
                  <th className="px-3 py-3 text-center font-medium">Статус</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={22} className="px-3 py-10 text-center text-slate-400">
                      Загрузка...
                    </td>
                  </tr>
                )}
                {!loading && agents.length === 0 && (
                  <tr>
                    <td colSpan={22} className="px-3 py-10 text-center text-slate-400">
                      Агенты не найдены
                    </td>
                  </tr>
                )}
                {!loading &&
                  agents.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-slate-50 hover:bg-teal-50/30"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={selected.includes(a.id)}
                          onChange={() =>
                            setSelected((sel) =>
                              sel.includes(a.id)
                                ? sel.filter((x) => x !== a.id)
                                : [...sel, a.id]
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            setEditing(a);
                            setFormOpen(true);
                          }}
                          className="text-left text-slate-700 hover:text-teal-700"
                        >
                          {a.fullname}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">
                        {a.productCount} шт.
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{a.agentType}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                        {a.code}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                        {a.pinfl || ""}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {a.consignation ? "Да" : "Нет"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{a.apkVersion}</td>
                      <td className="px-3 py-2.5 text-slate-600">{a.deviceName}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${syncColor(a.lastSync)}`}
                          />
                          {fmtDateTime(a.lastSync)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                        {a.phone}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{a.login}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1">
                          {a.priceTypes.slice(0, 2).map((p) => (
                            <Badge key={p}>{p}</Badge>
                          ))}
                          {a.priceTypes.length > 2 && (
                            <span className="group relative">
                              <span className="cursor-pointer whitespace-nowrap rounded-md border border-teal-100 bg-teal-50/60 px-1.5 py-0.5 text-[11px] text-teal-600 hover:bg-teal-100">
                                ещё {a.priceTypes.length - 2}
                              </span>
                              {/* Hover popover: full list of price types */}
                              <span className="invisible absolute left-1/2 top-full z-30 mt-1.5 w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white opacity-0 shadow-xl shadow-slate-900/10 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                                <span className="block border-b border-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Тип цены · {a.priceTypes.length}
                                </span>
                                {a.priceTypes.map((p) => (
                                  <span
                                    key={p}
                                    className="block border-b border-slate-50 px-3 py-2 text-left text-xs text-slate-700 last:border-0"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </span>
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {a.warehouse && <Badge>{a.warehouse}</Badge>}
                      </td>
                      <td className="px-3 py-2.5">
                        {a.tradeDirection && <Badge accent>{a.tradeDirection}</Badge>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{a.branch}</td>
                      <td className="px-3 py-2.5 text-slate-600">{a.position}</td>
                       <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                         {new Date(a.createdAt).toLocaleDateString("ru-RU")}
                       </td>
                       <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => setSessionsAgent(a)}
                          className="font-medium text-teal-700 underline decoration-dotted underline-offset-2 hover:text-teal-800"
                        >
                          {a.activeSessions}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">
                        {a.maxSessions}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {/* Индикатор доступа к приложению (не кнопка) */}
                        <span
                          title={
                            a.appAccess
                              ? "Доступ к приложению: включен"
                              : "Доступ к приложению: выключен"
                          }
                          className="inline-flex items-center justify-center"
                        >
                          <span
                            className={`h-3 w-3 rounded-full ring-2 ${
                              a.appAccess
                                ? "bg-emerald-500 ring-emerald-100"
                                : "bg-red-500 ring-red-100"
                            }`}
                          />
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            title="Редактировать"
                            onClick={() => {
                              setEditing(a);
                              setFormOpen(true);
                            }}
                            className="rounded-md border border-slate-200 p-1.5 text-amber-500 hover:bg-amber-50"
                          >
                            ✏
                          </button>
                        </div>
                       </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-slate-500">
              Показано&nbsp;&nbsp;{from} - {to} / {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ‹
              </button>
              {pageNumbers.map((n, i) =>
                n === "..." ? (
                  <span key={`e${i}`} className="px-1 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      n === page
                        ? "bg-teal-600 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating bulk action bar for selected agents */}
      {selected.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full border border-teal-200/70 bg-white/95 py-1.5 pl-4 pr-2 shadow-[0_8px_30px_rgba(13,148,136,0.25)] backdrop-blur">
            <span className="mr-1 flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-700">
              Выбрано
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-bold text-white">
                {selected.length}
              </span>
            </span>

            <span className="mx-1 h-6 w-px bg-slate-200" />

            {/* Single access toggle: on = all selected have access */}
            <button
              onClick={() =>
                bulkAction(allAccessOn ? "disable-access" : "enable-access")
              }
              disabled={bulkBusy}
              title={
                allAccessOn
                  ? "Выключить доступ к приложению у всех выбранных"
                  : "Включить доступ к приложению у всех выбранных"
              }
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Доступ
              <span
                className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
                  allAccessOn ? "bg-teal-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    allAccessOn ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>

            <span className="mx-1 h-6 w-px bg-slate-200" />

            <button
              onClick={() =>
                setRestrictionsTarget({
                  ids: selected,
                  label: `Выбрано агентов: ${selected.length}`,
                  priceTypes: [],
                  products: [],
                })
              }
              disabled={bulkBusy}
              title="Ограничения для всех выбранных"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              ⚙
            </button>

            <button
              onClick={() => setBulkEditOpen(true)}
              disabled={bulkBusy}
              title="Редактировать общие поля всех выбранных"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-amber-500 hover:bg-amber-50 disabled:opacity-50"
            >
              ✏
            </button>

            <button
              onClick={() =>
                setConfirmBulk(activeTab === "true" ? "deactivate" : "activate")
              }
              disabled={bulkBusy}
              title={
                activeTab === "true"
                  ? "Деактивировать всех выбранных"
                  : "Активировать всех выбранных"
              }
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 disabled:opacity-50 ${
                activeTab === "true"
                  ? "text-red-500 hover:bg-red-50"
                  : "text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              {activeTab === "true" ? "🚫" : "✔"}
            </button>

            <span className="mx-1 h-6 w-px bg-slate-200" />

            <button
              onClick={() => setConfirmBulk("clear-sessions")}
              disabled={bulkBusy}
              title="Завершить все активные сессии у выбранных агентов"
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              🧹 Очистить сессии
            </button>

            <span className="mx-1 h-6 w-px bg-slate-200" />

            <button
              onClick={() => setSelected([])}
              title="Снять выделение"
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {formOpen && (
        <AgentFormModal
          agent={editing}
          onClose={() => setFormOpen(false)}
          onSaved={load}
          onOpenRestrictions={() => {
            if (editing) {
              setFormOpen(false);
              setRestrictionsTarget({
                ids: [editing.id],
                label: editing.fullname,
                priceTypes: editing.priceTypes,
                products: editing.products,
              });
            }
          }}
        />
      )}
      {restrictionsTarget && (
        <RestrictionsModal
          ids={restrictionsTarget.ids}
          label={restrictionsTarget.label}
          initialPriceTypes={restrictionsTarget.priceTypes}
          initialProducts={restrictionsTarget.products}
          onClose={() => setRestrictionsTarget(null)}
          onSaved={load}
        />
      )}
      {sessionsAgent && (
        <SessionsModal
          agent={sessionsAgent}
          onClose={() => setSessionsAgent(null)}
          onChanged={load}
        />
      )}
      {confirmAgent && (
        <ConfirmDialog
          message={
            confirmAgent.active
              ? "Вы хотите деактивировать агента?"
              : "Вы хотите активировать агента?"
          }
          onNo={() => setConfirmAgent(null)}
          onYes={async () => {
            await patchAgent(confirmAgent.id, { active: !confirmAgent.active });
            setConfirmAgent(null);
            load();
          }}
        />
      )}

      {confirmBulk && (
        <ConfirmDialog
          message={
            confirmBulk === "deactivate"
              ? "Вы хотите деактивировать выбранных агентов?"
              : confirmBulk === "clear-sessions"
              ? "Вы хотите сбросить все сессии у выбранных агентов?"
              : "Вы хотите активировать выбранных агентов?"
          }
          onNo={() => setConfirmBulk(null)}
          onYes={async () => {
            const action = confirmBulk;
            setConfirmBulk(null);
            await bulkAction(action);
          }}
        />
      )}
      {bulkEditOpen && (
        <BulkEditModal
          ids={selected}
          onClose={() => setBulkEditOpen(false)}
          onDone={() => {
            setSelected([]);
            load();
          }}
        />
      )}
    </div>
  );
}
