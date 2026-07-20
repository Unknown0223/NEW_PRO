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
  loading: boolean;
  submitError?: string | null;
  onClose: () => void;
  onSubmitCreate: (body: Record<string, unknown>) => void;
  onSubmitEdit: (id: number, body: Record<string, unknown>) => Promise<unknown>;
};

export function AgentFormModal({
  mode,
  open,
  row,
  tenantSlug,
  loading,
  submitError,
  onClose,
  onSubmitCreate,
  onSubmitEdit
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
  const [agent_type, setAgentType] = useState("Торговый представитель");
  const [position, setPos] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [kpi_color, setKpi] = useState("#d41c1c");
  const [app_access, setAppAccess] = useState(true);
  const [max_sessions, setMaxSessions] = useState(1);
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
      setAgentType("Торговый представитель");
      setPos("");
      setCode("");
      setPinfl("");
      setLogin("");
      setPassword(randomPassword());
      setFormErr(null);
      setKpi("#d41c1c");
      setAppAccess(true);
      setMaxSessions(2);
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
    setAgentType(r.agent_type ?? "Торговый представитель");
    setPos(r.position ?? "");
    setCode(r.code ?? "");
    setPinfl(r.pinfl ?? "");
    setLogin(r.login);
    setPassword("");
    setFormErr(null);
    setKpi(r.kpi_color || "#d41c1c");
    setAppAccess(r.app_access);
    setMaxSessions(r.max_sessions);
  }, [open, isNew, r]);

  const handleSave = async () => {
    if (isNew && slotOptions.length > 0 && !work_slot_id.trim()) {
      setFormErr("Рабочее место обязательно — выберите свободный слот");
      return;
    }
    setFormErr(null);

    const body: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim() || null,
      middle_name: middle_name.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      agent_type: agent_type.trim() || null,
      position: position.trim() || null,
      code: code.trim() || null,
      pinfl: pinfl.trim() || null,
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

          <AgentFormSection title="Учётная запись и роль" icon={<Package className="h-4 w-4" />}>
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Склад, филиал, территория, направление и типы цен настраиваются в{" "}
              <a href="/work-slots" className="font-semibold underline">
                Рабочее место
              </a>
              {r?.work_slot_code ? (
                <>
                  {" "}
                  (сейчас:{" "}
                  <a
                    href={r.work_slot_id != null ? `/work-slots/${r.work_slot_id}` : "/work-slots"}
                    className="font-mono font-semibold underline"
                  >
                    {r.work_slot_code}
                  </a>
                  ).
                </>
              ) : (
                "."
              )}
            </p>
            <div className="grid grid-cols-2 gap-3">
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
                <AgentFormField
                  label={
                    slotOptions.length > 0
                      ? "Рабочее место *"
                      : "Рабочее место (пока нет слотов)"
                  }
                >
                  <AgentFormSelect
                    value={work_slot_id}
                    onChange={(v) => {
                      setWorkSlotId(v);
                      setFormErr(null);
                    }}
                    emptyLabel={
                      slotOptions.length > 0 ? "Выберите рабочее место" : "Слотов нет"
                    }
                    options={slotOptions.map((s) => ({
                      value: String(s.id),
                      label: `${s.slot_code}${s.label ? ` — ${s.label}` : ""}${s.active_user_name ? ` (сейчас: ${s.active_user_name})` : " (свободен)"}`
                    }))}
                  />
                </AgentFormField>
              ) : null}
              {isNew && formErr ? (
                <p className="text-xs text-red-600 col-span-full">{formErr}</p>
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

          <AgentFormSection title="KPI" icon={<Palette className="h-4 w-4" />}>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-xs text-slate-500">
                Консигнация, типы цен и ограничения продуктов — в{" "}
                <a href="/work-slots" className="font-semibold text-teal-700 underline">
                  Рабочее место
                </a>
              </p>
              <div className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
                <span>Цвет KPI</span>
                <input
                  type="color"
                  value={kpi_color}
                  onChange={(e) => setKpi(e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-card"
                />
              </div>
            </div>
          </AgentFormSection>

        </div>

        <div className="border-t border-border bg-muted px-6 py-4">
          {submitError ? <p className="mb-3 text-sm text-destructive">{submitError}</p> : null}
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
