"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Lock, Palette, Tag, Package, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import {
  AgentFormField,
  AgentFormSection,
  AgentFormSelect,
  agentModalInputClass,
  parseAgentFio
} from "@/components/staff/agent-workspace-template-ui";
import type { AgentRow } from "@/components/staff/agents-workspace";
import {
  CONSIGNMENT_CLOSE_DAY_OPTIONS,
  CONSIGNMENT_CLOSE_HOUR_OPTIONS,
  CONSIGNMENT_CLOSE_MINUTE_OPTIONS
} from "@/lib/consignment-close-schedule";

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

type Props = {
  mode: "create" | "edit";
  open: boolean;
  row: AgentRow | null;
  tenantSlug: string;
  warehouses: { id: number; name: string }[];
  branchOptions: string[];
  tradeDirections: Array<{ id: number; name: string; code: string | null }>;
  priceTypes: string[];
  loading: boolean;
  onClose: () => void;
  onSubmitCreate: (body: Record<string, unknown>) => void;
  onSubmitEdit: (id: number, body: Record<string, unknown>) => Promise<unknown>;
  onOpenRestrictions?: (r: AgentRow) => void;
};

export function AgentFormModal({
  mode,
  open,
  row,
  tenantSlug,
  warehouses,
  branchOptions,
  tradeDirections,
  priceTypes,
  loading,
  onClose,
  onSubmitCreate,
  onSubmitEdit,
  onOpenRestrictions
}: Props) {
  const isNew = mode === "create";

  const detailQ = useQuery({
    queryKey: ["agent-detail", tenantSlug, row?.id],
    enabled: !isNew && Boolean(row),
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<{ data: AgentRow }>(`/api/${tenantSlug}/agents/${row!.id}`);
      return data.data;
    }
  });

  const r = isNew ? null : (detailQ.data ?? row);

  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [warehouse_id, setWh] = useState("");
  const [trade_direction_id, setTdId] = useState("");
  const [agent_type, setAgentType] = useState("Торговый представитель");
  const [branch, setBranch] = useState("");
  const [position, setPos] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [consignment, setConsignment] = useState(false);
  const [closeDay, setCloseDay] = useState("25");
  const [closeHour, setCloseHour] = useState("0");
  const [closeMinute, setCloseMinute] = useState("0");
  const [closeErr, setCloseErr] = useState<string | null>(null);
  const [kpi_color, setKpi] = useState("#d41c1c");
  const [app_access, setAppAccess] = useState(true);
  const [max_sessions, setMaxSessions] = useState(1);
  const [priceTypesSel, setPriceTypesSel] = useState<Set<string>>(new Set());
  const [work_slot_id, setWorkSlotId] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [slotOptions, setSlotOptions] = useState<
    Array<{ id: number; slot_code: string; label: string | null; active_user_name: string | null }>
  >([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !isNew || !tenantSlug) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<{
          data: Array<{
            id: number;
            slot_code: string;
            label: string | null;
            active_user_name: string | null;
          }>;
        }>(`/api/${tenantSlug}/work-slots?slot_type=agent&limit=300&is_active=true`);
        if (cancelled) return;
        setSlotOptions(data.data ?? []);
      } catch {
        if (!cancelled) setSlotOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isNew, tenantSlug]);

  useEffect(() => {
    if (!open) return;
    if (isNew) {
      setFirst("");
      setLast("");
      setMid("");
      setPhone("");
      setEmail("");
      setWh("");
      setTdId("");
      setAgentType("Торговый представитель");
      setBranch("");
      setPos("");
      setCode("");
      setPinfl("");
      setLogin("");
      setPassword(randomPassword());
      setConsignment(false);
      setCloseDay("25");
      setCloseTime("00:00");
      setCloseErr(null);
      setKpi("#d41c1c");
      setAppAccess(true);
      setMaxSessions(2);
      setPriceTypesSel(new Set(priceTypes.length ? [priceTypes[0]!] : ["NAQD PUL"]));
      setWorkSlotId("");
      setShowPasswordField(true);
      return;
    }
    if (!r) return;
    setShowPasswordField(false);
    const parsed = parseAgentFio(r.fio);
    setFirst((r.first_name ?? "").trim() || parsed.first);
    setLast((r.last_name ?? "").trim() || parsed.last);
    setMid((r.middle_name ?? "").trim() || parsed.middle);
    setPhone(r.phone ?? "");
    setEmail(r.email ?? "");
    const wh = warehouses.find((w) => w.name === r.warehouse);
    setWh(wh ? String(wh.id) : "");
    if (r.trade_direction_id != null && r.trade_direction_id > 0) {
      setTdId(String(r.trade_direction_id));
    } else {
      const legacy = (r.trade_direction ?? "").trim();
      const match = tradeDirections.find(
        (d) =>
          (d.code && d.code.trim() === legacy) ||
          d.name.trim() === legacy ||
          legacy === `${d.name} (${d.code})`.trim()
      );
      setTdId(match ? String(match.id) : "");
    }
    setAgentType(r.agent_type ?? "Торговый представитель");
    setBranch(r.branch ?? "");
    setPos(r.position ?? "");
    setCode(r.code ?? "");
    setPinfl(r.pinfl ?? "");
    setLogin(r.login);
    setPassword("");
    setConsignment(r.consignment);
    setCloseDay(String(r.consignment_close_day ?? 25));
    setCloseHour(String(r.consignment_close_hour ?? 0));
    setCloseMinute(String(r.consignment_close_minute ?? 0));
    setCloseErr(null);
    setKpi(r.kpi_color || "#d41c1c");
    setAppAccess(r.app_access);
    setMaxSessions(r.max_sessions);
    const pts = r.price_types?.length ? r.price_types : r.price_type ? [r.price_type] : [];
    setPriceTypesSel(new Set(pts));
  }, [open, isNew, r, warehouses, tradeDirections, priceTypes]);

  const togglePrice = (pt: string) => {
    setPriceTypesSel((prev) => {
      const next = new Set(prev);
      if (next.has(pt)) next.delete(pt);
      else next.add(pt);
      return next;
    });
  };

  const allPrices =
    priceTypes.length > 0 ? priceTypes : ["NAQD PUL", "PERECHISLENIYE", "NASIYA", "KORPORATIV"];

  const handleSave = async () => {
    let consignment_close_day: number | undefined;
    let consignment_close_hour: number | undefined;
    let consignment_close_minute: number | undefined;
    if (consignment) {
      const d = Number.parseInt(closeDay, 10);
      const h = Number.parseInt(closeHour, 10);
      const m = Number.parseInt(closeMinute, 10);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        setCloseErr("День закрытия: от 1 до 31");
        return;
      }
      setCloseErr(null);
      consignment_close_day = d;
      consignment_close_hour = h;
      consignment_close_minute = m;
    }

    const body: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim() || null,
      middle_name: middle_name.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      warehouse_id: warehouse_id ? Number.parseInt(warehouse_id, 10) : null,
      trade_direction_id: trade_direction_id.trim() ? Number.parseInt(trade_direction_id.trim(), 10) : null,
      agent_type: agent_type.trim() || null,
      branch: branch.trim() || null,
      position: position.trim() || null,
      code: code.trim() || null,
      pinfl: pinfl.trim() || null,
      consignment,
      ...(consignment
        ? {
            consignment_close_day,
            consignment_close_hour,
            consignment_close_minute
          }
        : {}),
      kpi_color: kpi_color || null,
      app_access,
      max_sessions
    };
    if (isNew) {
      onSubmitCreate({
        ...body,
        login: login.trim().toLowerCase(),
        password,
        can_authorize: true,
        work_slot_id: work_slot_id.trim() ? Number.parseInt(work_slot_id.trim(), 10) : null
      });
      return;
    }
    if (!r) return;
    if (password.trim().length >= 6) body.password = password.trim();
    await onSubmitEdit(r.id, body);
    onClose();
  };

  if (!open) return null;
  if (!isNew && !r) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isNew ? "Новый агент" : "Редактировать"}
            </h2>
            <p className="text-xs text-slate-500">
              {isNew
                ? "Заполните данные нового торгового представителя"
                : `Код: ${r?.code ?? "—"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-muted hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <AgentFormSection title="Личные данные" icon={<Tag className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <AgentFormField label="Имя">
                <input
                  value={first_name}
                  onChange={(e) => setFirst(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="Иван"
                />
              </AgentFormField>
              <AgentFormField label="Фамилия">
                <input
                  value={last_name}
                  onChange={(e) => setLast(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="Иванов"
                />
              </AgentFormField>
              <AgentFormField label="Отчество">
                <input
                  value={middle_name}
                  onChange={(e) => setMid(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="Иванович"
                />
              </AgentFormField>
              <AgentFormField label="E-mail">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="agent@company.uz"
                />
              </AgentFormField>
              <AgentFormField label="Телефон">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="998901234567"
                />
              </AgentFormField>
              <AgentFormField label="ПИНФЛ">
                <input
                  value={pinfl}
                  onChange={(e) => setPinfl(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="14 цифр"
                />
              </AgentFormField>
            </div>
          </AgentFormSection>

          <AgentFormSection title="Настройки продаж" icon={<Package className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <AgentFormField label="Склад">
                <AgentFormSelect
                  value={warehouse_id}
                  onChange={setWh}
                  emptyLabel="Склад"
                  options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
                />
              </AgentFormField>
              <AgentFormField label="Филиал">
                <AgentFormSelect
                  value={branch}
                  onChange={setBranch}
                  emptyLabel="Филиал"
                  options={branchOptions.map((b) => ({ value: b, label: b }))}
                />
              </AgentFormField>
              <AgentFormField label="Направление торговли">
                <AgentFormSelect
                  value={trade_direction_id}
                  onChange={setTdId}
                  emptyLabel="Tanlanmagan"
                  options={tradeDirections.map((t) => ({
                    value: String(t.id),
                    label: `${t.name}${t.code ? ` (${t.code})` : ""}`
                  }))}
                />
              </AgentFormField>
              <AgentFormField label="Тип агента">
                <AgentFormSelect
                  value={agent_type}
                  onChange={setAgentType}
                  options={[
                    { value: "Торговый представитель", label: "Торговый представитель" },
                    { value: "Мерчендайзер", label: "Мерчендайзер" },
                    { value: "Супервайзер", label: "Супервайзер" },
                    { value: "Экспедитор", label: "Экспедитор" }
                  ]}
                />
              </AgentFormField>
              <AgentFormField label="Код">
                <div className="relative">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={20}
                    className={`${agentModalInputClass} pr-14`}
                    placeholder="GGTSH005"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {code.length}/20
                  </span>
                </div>
              </AgentFormField>
              <AgentFormField label="Логин">
                <div className="relative">
                  <input
                    value={login}
                    onChange={(e) => setLogin(e.target.value.toLowerCase())}
                    maxLength={20}
                    disabled={!isNew}
                    className={`${agentModalInputClass} pr-14 disabled:bg-muted disabled:text-slate-500`}
                    placeholder="tsh3741"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {login.length}/20
                  </span>
                </div>
              </AgentFormField>
              <AgentFormField label="Должность">
                <input
                  value={position}
                  onChange={(e) => setPos(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="Торговый представитель"
                />
              </AgentFormField>
              {isNew ? (
                <AgentFormField label="Ishchi o‘rni (ixtiyoriy)">
                  <AgentFormSelect
                    value={work_slot_id}
                    onChange={setWorkSlotId}
                    emptyLabel="Tanlanmagan"
                    options={slotOptions.map((s) => ({
                      value: String(s.id),
                      label: `${s.slot_code}${s.label ? ` — ${s.label}` : ""}${s.active_user_name ? ` (hozir: ${s.active_user_name})` : " (bo‘sh)"}`
                    }))}
                  />
                </AgentFormField>
              ) : null}
            </div>
          </AgentFormSection>

          <AgentFormSection title="Настройки доступа" icon={<Shield className="h-4 w-4" />}>
            <div className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-slate-700 hover:bg-muted"
                onClick={() => {
                  if (isNew) {
                    setPassword(randomPassword());
                    setShowPasswordField(true);
                  } else {
                    setShowPasswordField(true);
                  }
                }}
              >
                <Lock className="h-4 w-4" /> {isNew ? "Сгенерировать пароль" : "Изменить пароль"}
              </button>
              {(isNew || showPasswordField) && (
                <AgentFormField label={isNew ? "Пароль *" : "Новый пароль (мин. 6)"}>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={agentModalInputClass}
                    autoComplete="new-password"
                  />
                </AgentFormField>
              )}
              <div className="grid grid-cols-2 gap-3">
                <AgentFormField label="Макс. сессий">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={max_sessions}
                    onChange={(e) => setMaxSessions(Number(e.target.value))}
                    className={agentModalInputClass}
                  />
                </AgentFormField>
                <AgentFormField label="Доступ к приложению">
                  <label className="flex h-[42px] items-center justify-between rounded-lg border border-border bg-card px-3">
                    <span className="text-sm text-slate-700">Включен</span>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={app_access}
                      onChange={(e) => setAppAccess(e.target.checked)}
                    />
                    <div className="relative h-5 w-9 rounded-full bg-muted transition peer-checked:bg-teal-500">
                      <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition peer-checked:translate-x-4" />
                    </div>
                  </label>
                </AgentFormField>
              </div>
            </div>
          </AgentFormSection>

          <AgentFormSection title="KPI и продукты" icon={<Palette className="h-4 w-4" />}>
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border border-border bg-card px-3 py-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={consignment}
                    onChange={(e) => setConsignment(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-teal-600 focus:ring-teal-500"
                  />
                  Консигнация
                </label>
                {consignment ? (
                  <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2">
                    <AgentFormField label="День месяца">
                      <AgentFormSelect
                        value={closeDay}
                        onChange={setCloseDay}
                        options={CONSIGNMENT_CLOSE_DAY_OPTIONS.map((d) => ({
                          value: String(d),
                          label: String(d)
                        }))}
                      />
                    </AgentFormField>
                    <AgentFormField label="Часы">
                      <AgentFormSelect
                        value={closeHour}
                        onChange={setCloseHour}
                        options={CONSIGNMENT_CLOSE_HOUR_OPTIONS.map((h) => ({
                          value: String(h),
                          label: String(h).padStart(2, "0")
                        }))}
                      />
                    </AgentFormField>
                    <AgentFormField label="Минуты">
                      <AgentFormSelect
                        value={closeMinute}
                        onChange={setCloseMinute}
                        options={CONSIGNMENT_CLOSE_MINUTE_OPTIONS.map((m) => ({
                          value: String(m),
                          label: String(m).padStart(2, "0")
                        }))}
                      />
                    </AgentFormField>
                  </div>
                ) : null}
                {closeErr ? <p className="text-xs text-red-600">{closeErr}</p> : null}
              </div>
              <div className="flex items-center justify-end rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span>Цвет для KPI</span>
                  <input
                    type="color"
                    value={kpi_color}
                    onChange={(e) => setKpi(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-card"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Тип цены: {priceTypesSel.size} шт
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allPrices.map((pt) => {
                    const active = priceTypesSel.has(pt);
                    return (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => togglePrice(pt)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500/30"
                            : "border-border bg-card text-slate-600 hover:border-border"
                        }`}
                      >
                        {pt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-sm">
                <span className="text-slate-600">
                  Продукты: {r?.product ? "настроены" : "ограничения в модале"}
                </span>
                {!isNew && r && onOpenRestrictions ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-teal-700 hover:text-teal-800"
                    onClick={() => onOpenRestrictions(r)}
                  >
                    Выбрать →
                  </button>
                ) : null}
              </div>
            </div>
          </AgentFormSection>

          {!isNew && onOpenRestrictions && r ? (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              onClick={() => onOpenRestrictions(r)}
            >
              <Shield className="h-4 w-4" /> Ограничения
            </button>
          ) : null}
        </div>

        <div className="border-t border-border bg-muted px-6 py-4">
          <button
            type="button"
            disabled={
              loading ||
              !first_name.trim() ||
              (isNew && (!login.trim() || password.length < 6))
            }
            onClick={() => void handleSave()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {isNew ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
