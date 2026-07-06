"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import type { Agent, AgentSession } from "@/lib/types";
import {
  AGENT_TYPES,
  BRANCHES,
  POSITIONS,
  PRICE_TYPES,
  PRODUCT_CATEGORIES,
  TRADE_DIRECTIONS,
  WAREHOUSES,
  type ProductCategory,
} from "@/lib/dictionaries";

/* ---------- Shared modal shell ---------- */
export function Modal({
  title,
  onClose,
  children,
  width = "max-w-lg",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${width} rounded-xl bg-white shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Field helpers ---------- */
function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="absolute -top-2 left-2.5 z-[1] bg-white px-1 text-[11px] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

/* ---------- Agent create / edit ---------- */
export function AgentFormModal({
  agent,
  onClose,
  onSaved,
  onOpenRestrictions,
}: {
  agent: Agent | null;
  onClose: () => void;
  onSaved: () => void;
  onOpenRestrictions: (draftId: number) => void;
}) {
  const [form, setForm] = useState({
    firstName: agent?.firstName ?? "",
    lastName: agent?.lastName ?? "",
    middleName: agent?.middleName ?? "",
    phone: agent?.phone ?? "",
    email: agent?.email ?? "",
    warehouse: agent?.warehouse ?? "",
    tradeDirection: agent?.tradeDirection ?? "",
    agentType: agent?.agentType ?? "Торговый представитель",
    code: agent?.code ?? "",
    pinfl: agent?.pinfl ?? "",
    branch: agent?.branch ?? "",
    position: agent?.position ?? "",
    login: agent?.login ?? "",
    consignation: agent?.consignation ?? false,
    kpiColor: agent?.kpiColor ?? "#e11d48",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(agent ? `/api/agents/${agent.id}` : "/api/agents", {
        method: agent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Ошибка сохранения");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={agent ? "Редактировать" : "Добавить агента"} onClose={onClose} width="max-w-md">
      <div className="space-y-4">
        <Field label="Имя">
          <input className={inputCls} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Фамилия">
          <input className={inputCls} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label="Отчество">
          <input className={inputCls} value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
        </Field>
        <Field label="Телефон">
          <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Склад">
          <select className={inputCls} value={form.warehouse} onChange={(e) => set("warehouse", e.target.value)}>
            <option value="">—</option>
            {WAREHOUSES.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </Field>
        <Field label="Направление торговли">
          <select className={inputCls} value={form.tradeDirection} onChange={(e) => set("tradeDirection", e.target.value)}>
            <option value="">—</option>
            {TRADE_DIRECTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Тип агента">
          <select className={inputCls} value={form.agentType} onChange={(e) => set("agentType", e.target.value)}>
            {AGENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Код">
          <div className="relative">
            <input className={inputCls} maxLength={20} value={form.code} onChange={(e) => set("code", e.target.value)} />
            <span className="absolute right-3 top-2.5 text-[11px] text-slate-400">
              {form.code.length} / 20
            </span>
          </div>
        </Field>
        <Field label="ПИНФЛ">
          <input className={inputCls} value={form.pinfl} onChange={(e) => set("pinfl", e.target.value)} />
        </Field>
        <Field label="Филиал">
          <select className={inputCls} value={form.branch} onChange={(e) => set("branch", e.target.value)}>
            <option value="">—</option>
            {BRANCHES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Должность">
          <select className={inputCls} value={form.position} onChange={(e) => set("position", e.target.value)}>
            <option value="">—</option>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Логин">
          <div className="relative">
            <input className={inputCls} maxLength={20} value={form.login} onChange={(e) => set("login", e.target.value)} />
            <span className="absolute right-3 top-2.5 text-[11px] text-slate-400">
              {form.login.length} / 20
            </span>
          </div>
        </Field>

        <button className="w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50">
          Изменить пароль
        </button>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-600"
              checked={form.consignation}
              onChange={(e) => set("consignation", e.target.checked)}
            />
            Консигнация
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Выбрать цвет для KPI
            <input
              type="color"
              value={form.kpiColor}
              onChange={(e) => set("kpiColor", e.target.value)}
              className="h-6 w-7 cursor-pointer rounded border border-slate-200"
            />
          </label>
        </div>

        {agent && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                Тип цены: <b>{agent.priceTypes.length} шт</b>
              </span>
              <span className="text-teal-600">
                Продукты: <b>{agent.productCount} шт</b>
              </span>
            </div>
            <button
              onClick={() => onOpenRestrictions(agent.id)}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ограничения
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Restrictions (price types + products) ---------- */
export function RestrictionsModal({
  ids,
  label,
  initialPriceTypes,
  initialProducts,
  onClose,
  onSaved,
}: {
  ids: number[];
  label: string;
  initialPriceTypes: string[];
  initialProducts: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [priceTypes, setPriceTypes] = useState<string[]>(initialPriceTypes);
  const [products, setProducts] = useState<string[]>(initialProducts);
  const [ptSearch, setPtSearch] = useState("");
  const [prSearch, setPrSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const filteredPt = useMemo(
    () => PRICE_TYPES.filter((p) => p.toLowerCase().includes(ptSearch.toLowerCase())),
    [ptSearch]
  );

  const allProductItems = useMemo(
    () => PRODUCT_CATEGORIES.flatMap((c) => c.items),
    []
  );

  // Filter categories: match by category name or by items inside
  const filteredCategories = useMemo(() => {
    const q = prSearch.trim().toLowerCase();
    if (!q) return PRODUCT_CATEGORIES;
    return PRODUCT_CATEGORIES.map((c) => {
      if (c.name.toLowerCase().includes(q)) return c;
      const items = c.items.filter((i) => i.toLowerCase().includes(q));
      return items.length ? { name: c.name, items } : null;
    }).filter((c): c is ProductCategory => c !== null);
  }, [prSearch]);

  const toggle = (list: string[], setList: (v: string[]) => void, v: string) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const toggleExpand = (name: string) =>
    setExpanded((e) =>
      e.includes(name) ? e.filter((x) => x !== name) : [...e, name]
    );

  const categoryState = (c: ProductCategory) => {
    const sel = c.items.filter((i) => products.includes(i)).length;
    return { all: sel === c.items.length && c.items.length > 0, some: sel > 0 };
  };

  const toggleCategory = (c: ProductCategory) => {
    const { all } = categoryState(c);
    setProducts((prev) => {
      const without = prev.filter((p) => !c.items.includes(p));
      return all ? without : [...without, ...c.items];
    });
  };

  const save = async () => {
    setSaving(true);
    if (ids.length === 1) {
      await fetch(`/api/agents/${ids[0]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceTypes, products }),
      });
    } else {
      await fetch("/api/agents/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          action: "edit",
          fields: { priceTypes, products },
        }),
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal title="Ограничения" onClose={onClose} width="max-w-3xl">
      {/* Agent chip */}
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-emerald-50/60 px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm text-white shadow-sm">
          {ids.length > 1 ? ids.length : "👤"}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-teal-600">
            {ids.length > 1 ? "Агенты" : "Агент"}
          </p>
          <p className="truncate text-sm font-semibold text-slate-800">{label}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* ===== Тип цены ===== */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">💳</span>
              <h4 className="text-sm font-semibold text-slate-800">Тип цены</h4>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">
                {priceTypes.length}/{PRICE_TYPES.length}
              </span>
            </div>
            <button
              onClick={() =>
                setPriceTypes(
                  priceTypes.length === PRICE_TYPES.length ? [] : [...PRICE_TYPES]
                )
              }
              className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
            >
              {priceTypes.length === PRICE_TYPES.length
                ? "Снять все"
                : "Выбрать все"}
            </button>
          </div>
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                🔍
              </span>
              <input
                placeholder="Поиск..."
                value={ptSearch}
                onChange={(e) => setPtSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-2.5 text-sm outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
              />
            </div>
          </div>
          <div className="max-h-64 flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {filteredPt.map((item) => {
              const checked = priceTypes.includes(item);
              return (
                <label
                  key={item}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    checked
                      ? "bg-teal-50 font-medium text-teal-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-600"
                    checked={checked}
                    onChange={() => toggle(priceTypes, setPriceTypes, item)}
                  />
                  {item}
                  {checked && (
                    <span className="ml-auto text-xs text-teal-500">✓</span>
                  )}
                </label>
              );
            })}
            {filteredPt.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">
                Ничего не найдено
              </p>
            )}
          </div>
        </div>

        {/* ===== Продукт (категории) ===== */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <h4 className="text-sm font-semibold text-slate-800">Продукт</h4>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">
                {products.length}/{allProductItems.length}
              </span>
            </div>
            <button
              onClick={() =>
                setProducts(
                  products.length === allProductItems.length
                    ? []
                    : [...allProductItems]
                )
              }
              className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
            >
              {products.length === allProductItems.length
                ? "Снять все"
                : "Выбрать все"}
            </button>
          </div>
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                🔍
              </span>
              <input
                placeholder="Поиск..."
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-2.5 text-sm outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
              />
            </div>
          </div>
          <div className="max-h-64 flex-1 space-y-1 overflow-y-auto p-1.5">
            {filteredCategories.map((c) => {
              const st = categoryState(c);
              const isOpen = expanded.includes(c.name) || prSearch.trim() !== "";
              const selCount = c.items.filter((i) => products.includes(i)).length;
              return (
                <div
                  key={c.name}
                  className={`overflow-hidden rounded-lg border transition-colors ${
                    st.some
                      ? "border-teal-200 bg-teal-50/40"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <div
                    className={`flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition-colors hover:bg-teal-50/60 ${
                      isOpen ? "border-b border-teal-100/60" : ""
                    }`}
                    onClick={() => toggleExpand(c.name)}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-600"
                      checked={st.all}
                      ref={(el) => {
                        if (el) el.indeterminate = !st.all && st.some;
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleCategory(c)}
                    />
                    <span className="flex-1 truncate text-sm font-semibold text-slate-800">
                      {c.name}
                    </span>
                    {selCount > 0 && (
                      <span className="rounded-full bg-teal-600 px-1.5 py-px text-[10px] font-bold text-white">
                        {selCount}
                      </span>
                    )}
                    <span className="rounded-md bg-slate-100 px-1.5 py-px text-[10px] text-slate-500">
                      {c.items.length}
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] text-slate-400 shadow-sm ring-1 ring-slate-200 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-teal-600 ring-teal-200" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </div>
                  {isOpen && (
                    <div className="space-y-0.5 bg-white/60 py-1 pl-3 pr-1.5">
                      {c.items.map((item) => {
                        const checked = products.includes(item);
                        return (
                          <label
                            key={item}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors ${
                              checked
                                ? "font-medium text-teal-800"
                                : "text-slate-600 hover:bg-slate-50"
                            }`}
                            style={{
                              borderLeft: checked
                                ? "2px solid #0d9488"
                                : "2px solid #e2e8f0",
                            }}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-teal-600"
                              checked={checked}
                              onChange={() => toggle(products, setProducts, item)}
                            />
                            {item}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredCategories.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">
                Ничего не найдено
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          Выбрано: <b className="text-teal-700">{priceTypes.length}</b> тип цены ·{" "}
          <b className="text-teal-700">{products.length}</b> товаров
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-teal-600/25 transition-all hover:from-teal-700 hover:to-teal-600 hover:shadow-lg hover:shadow-teal-600/30 disabled:opacity-60"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Sessions modal ---------- */
export function SessionsModal({
  agent,
  onClose,
  onChanged,
}: {
  agent: Agent;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [maxSessions, setMaxSessions] = useState(agent.maxSessions);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agent.id}/sessions`)
      .then((r) => r.json())
      .then((rows) => setSessions(rows))
      .finally(() => setLoading(false));
  }, [agent.id]);

  const saveMax = async () => {
    setBusy(true);
    await fetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxSessions }),
    });
    setBusy(false);
    onChanged();
  };

  const terminate = async (ids?: number[]) => {
    setBusy(true);
    const res = await fetch(`/api/agents/${agent.id}/sessions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { sessionIds: ids } : {}),
    });
    setSessions(await res.json());
    setSelected([]);
    setBusy(false);
    onChanged();
  };

  return (
    <Modal title="Активные сессии" onClose={onClose} width="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-700">Максимальное количество сессий</span>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-800">
          {maxSessions}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setMaxSessions((m) => Math.max(1, m - 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            − Уменьшить
          </button>
          <button
            onClick={() => setMaxSessions((m) => Math.min(10, m + 1))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            + Увеличить
          </button>
          <button
            onClick={saveMax}
            disabled={busy}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            Сохранить
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-600"
                  checked={selected.length === sessions.length && sessions.length > 0}
                  onChange={(e) =>
                    setSelected(e.target.checked ? sessions.map((s) => s.id) : [])
                  }
                />
              </th>
              <th className="px-3 py-2 font-medium">Устройство</th>
              <th className="px-3 py-2 font-medium">IP адрес</th>
              <th className="px-3 py-2 font-medium">ОС</th>
              <th className="px-3 py-2 font-medium">Приложение</th>
              <th className="px-3 py-2 font-medium">Дата создания ▾</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Загрузка...
                </td>
              </tr>
            )}
            {!loading && sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Нет активных сессий
                </td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-600"
                    checked={selected.includes(s.id)}
                    onChange={() =>
                      setSelected((sel) =>
                        sel.includes(s.id)
                          ? sel.filter((x) => x !== s.id)
                          : [...sel, s.id]
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2.5 text-slate-700">{s.device}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.ip}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.os}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{s.appInfo}</td>
                <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => terminate(selected)}
          disabled={selected.length === 0 || busy}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-40"
        >
          Завершить выбранные сессии
        </button>
        <button
          onClick={() => terminate()}
          disabled={sessions.length === 0 || busy}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          Завершить все сессии
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Confirm dialog ---------- */
export function ConfirmDialog({
  message,
  onNo,
  onYes,
}: {
  message: string;
  onNo: () => void;
  onYes: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <p className="mb-5 text-center text-base font-semibold text-slate-800">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onNo}
            className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Нет
          </button>
          <button
            onClick={onYes}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Да
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bulk edit: only fields common to all agents ---------- */
export function BulkEditModal({
  ids,
  onClose,
  onDone,
}: {
  ids: number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [fields, setFields] = useState({
    warehouse: "",
    tradeDirection: "",
    branch: "",
    position: "",
    agentType: "",
  });
  const [consignation, setConsignation] = useState<"" | "true" | "false">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof fields, v: string) =>
    setFields((f) => ({ ...f, [k]: v }));

  const hasChanges =
    Object.values(fields).some((v) => v !== "") || consignation !== "";

  const apply = async () => {
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v) payload[k] = v;
    }
    if (consignation !== "") payload.consignation = consignation === "true";

    const res = await fetch("/api/agents/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action: "edit", fields: payload }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error ?? "Ошибка");
      return;
    }
    onDone();
    onClose();
  };

  return (
    <Modal title="Редактировать выбранных" onClose={onClose} width="max-w-md">
      <p className="mb-4 text-sm text-slate-600">
        Выбрано агентов: <b>{ids.length}</b>. Изменяются только общие поля —
        пустые поля останутся без изменений.
      </p>
      <div className="space-y-4">
        <Field label="Склад">
          <select className={inputCls} value={fields.warehouse} onChange={(e) => set("warehouse", e.target.value)}>
            <option value="">Не изменять</option>
            {WAREHOUSES.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </Field>
        <Field label="Направление торговли">
          <select className={inputCls} value={fields.tradeDirection} onChange={(e) => set("tradeDirection", e.target.value)}>
            <option value="">Не изменять</option>
            {TRADE_DIRECTIONS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Филиал">
          <select className={inputCls} value={fields.branch} onChange={(e) => set("branch", e.target.value)}>
            <option value="">Не изменять</option>
            {BRANCHES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Должность">
          <select className={inputCls} value={fields.position} onChange={(e) => set("position", e.target.value)}>
            <option value="">Не изменять</option>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Тип агента">
          <select className={inputCls} value={fields.agentType} onChange={(e) => set("agentType", e.target.value)}>
            <option value="">Не изменять</option>
            {AGENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Консигнация">
          <select
            className={inputCls}
            value={consignation}
            onChange={(e) => setConsignation(e.target.value as "" | "true" | "false")}
          >
            <option value="">Не изменять</option>
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </select>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={apply}
          disabled={busy || !hasChanges}
          className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}
