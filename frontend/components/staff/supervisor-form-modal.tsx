"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, X } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import {
  AgentFormField,
  AgentFormSelect,
  agentModalInputClass,
  parseAgentFio
} from "@/components/staff/agent-workspace-template-ui";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";

export type SupervisorFormRow = {
  id: number;
  fio: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  code: string | null;
  pinfl: string | null;
  branch: string | null;
  position: string | null;
  login: string;
  phone: string | null;
  kpi_color: string | null;
  is_active: boolean;
  supervisees: Array<{ id: number; fio: string; code: string | null; is_active?: boolean }>;
};

function superviseeIsActive(
  s: { id: number; is_active?: boolean },
  activePickerIds: Set<number>
): boolean {
  if (s.is_active === false) return false;
  if (s.is_active === true) return true;
  return activePickerIds.has(s.id);
}

function agentAvailableForSupervisorPick(
  agent: { supervisor_user_id?: number | null },
  supervisorId: number | null | undefined
): boolean {
  if (agent.supervisor_user_id == null) return true;
  if (supervisorId == null) return false;
  return agent.supervisor_user_id === supervisorId;
}

export type SupervisorPickerAgent = {
  id: number;
  fio: string;
  code: string | null;
  supervisor_user_id?: number | null;
};

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

type Props = {
  mode: "create" | "edit";
  open: boolean;
  row: SupervisorFormRow | null;
  tenantSlug: string;
  branchOptions: string[];
  positionSuggestions: string[];
  agents: SupervisorPickerAgent[];
  /** Tahrirlash: joriy SVR id; yangi SVR: null */
  supervisorId?: number | null;
  loading: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmitCreate: (body: Record<string, unknown>, superviseeIds: number[]) => void;
  onSubmitEdit: (id: number, body: Record<string, unknown>) => Promise<unknown>;
};

export function SupervisorFormModal({
  mode,
  open,
  row,
  tenantSlug,
  branchOptions,
  positionSuggestions,
  agents,
  supervisorId = null,
  loading,
  errorMessage,
  onClose,
  onSubmitCreate,
  onSubmitEdit
}: Props) {
  const isNew = mode === "create";

  const detailQ = useQuery({
    queryKey: ["supervisor-detail", tenantSlug, row?.id],
    enabled: !isNew && open && Boolean(row),
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<{ data: SupervisorFormRow }>(`/api/${tenantSlug}/supervisors/${row!.id}`);
      return data.data;
    }
  });

  const r = isNew ? null : (detailQ.data ?? row);

  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [agSel, setAgSel] = useState<Set<number>>(new Set());
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [kpi_color, setKpi] = useState("#0d9488");
  const [is_active, setIsActive] = useState(true);
  const [agSearch, setAgSearch] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [detachingInactive, setDetachingInactive] = useState(false);

  const activePickerIds = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);

  const pickableAgents = useMemo(
    () => agents.filter((a) => agentAvailableForSupervisorPick(a, supervisorId)),
    [agents, supervisorId]
  );

  const inactiveLinked = useMemo(() => {
    if (isNew || !r) return [];
    return r.supervisees.filter((s) => !superviseeIsActive(s, activePickerIds));
  }, [isNew, r, activePickerIds]);

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
    if (!open) return;
    setFieldErrors({});
    if (isNew) {
      setFirst("");
      setLast("");
      setMid("");
      setPhone("");
      setCode("");
      setPinfl("");
      setBranch("");
      setPosition("");
      setAgSel(new Set());
      setLogin("");
      setPassword(randomPassword());
      setShowPassword(true);
      setKpi("#0d9488");
      setIsActive(true);
      setAgSearch("");
      return;
    }
    if (!r) return;
    const parsed = parseAgentFio(r.fio);
    setFirst((r.first_name ?? "").trim() || parsed.first);
    setLast((r.last_name ?? "").trim() || parsed.last);
    setMid((r.middle_name ?? "").trim() || parsed.middle);
    setPhone(r.phone ?? "");
    setCode(r.code ?? "");
    setPinfl(r.pinfl ?? "");
    setBranch(r.branch ?? "");
    setPosition(r.position ?? "");
    setLogin(r.login);
    setPassword("");
    setShowPassword(false);
    setKpi(r.kpi_color || "#0d9488");
    setIsActive(r.is_active);
    setAgSearch("");
    setAgSel(
      new Set(
        r.supervisees
          .filter((s) => superviseeIsActive(s, activePickerIds))
          .filter((s) => pickableAgents.some((a) => a.id === s.id))
          .map((s) => s.id)
      )
    );
  }, [open, isNew, r, pickableAgents, activePickerIds]);

  const filteredAgents = useMemo(() => {
    const q = agSearch.trim().toLowerCase();
    const base = pickableAgents;
    if (!q) return base;
    return base.filter((a) => `${a.fio} ${a.code ?? ""} ${a.id}`.toLowerCase().includes(q));
  }, [pickableAgents, agSearch]);

  const positionOptions = useMemo(() => {
    const set = new Set(positionSuggestions.map((p) => p.trim()).filter(Boolean));
    if (position.trim()) set.add(position.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [positionSuggestions, position]);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!first_name.trim()) errs.first_name = "Имя обязательно.";
    if (isNew) {
      if (!login.trim()) errs.login = "Логин обязателен.";
      if (password.length < 6) errs.password = "Пароль — минимум 6 символов.";
    } else if (password.trim().length > 0 && password.trim().length < 6) {
      errs.password = "Пароль — минимум 6 символов.";
    }
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    const body: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim() || null,
      middle_name: middle_name.trim() || null,
      phone: phone.trim() || null,
      code: code.trim() || null,
      pinfl: pinfl.trim() || null,
      branch: branch.trim() || null,
      position: position.trim() || null,
      kpi_color: kpi_color || null,
      is_active,
      can_authorize: is_active,
      app_access: true,
      consignment: false
    };
    if (isNew) {
      onSubmitCreate(
        {
          ...body,
          login: login.trim().toLowerCase(),
          password
        },
        Array.from(agSel)
      );
      return;
    }
    if (!r) return;
    body.supervisee_agent_ids = Array.from(agSel);
    if (password.trim().length >= 6) body.password = password.trim();
    await onSubmitEdit(r.id, body);
    onClose();
  };

  const handleDetachInactive = async () => {
    if (!r || inactiveLinked.length === 0) return;
    setDetachingInactive(true);
    try {
      await onSubmitEdit(r.id, { supervisee_agent_ids: Array.from(agSel) });
      onClose();
    } finally {
      setDetachingInactive(false);
    }
  };

  if (!open) return null;
  if (!isNew && !r) return null;

  const inputErr = (name: string) =>
    fieldErrors[name] ? "border-destructive focus:border-destructive focus:ring-destructive/20" : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{isNew ? "Добавить" : "Редактировать"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-muted hover:text-slate-900"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <AgentFormField label="Имя *">
            <input
              value={first_name}
              onChange={(e) => setFirst(e.target.value)}
              className={`${agentModalInputClass} ${inputErr("first_name")}`}
              placeholder="Имя"
            />
            {fieldErrors.first_name ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.first_name}</p>
            ) : null}
          </AgentFormField>

          <AgentFormField label="Фамилия">
            <input
              value={last_name}
              onChange={(e) => setLast(e.target.value)}
              className={agentModalInputClass}
              placeholder="Фамилия"
            />
          </AgentFormField>

          <AgentFormField label="Отчество">
            <input
              value={middle_name}
              onChange={(e) => setMid(e.target.value)}
              className={agentModalInputClass}
              placeholder="Отчество"
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

          <AgentFormField label="Код">
            <div className="relative">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
                className={`${agentModalInputClass} pr-14`}
                placeholder="Код"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {code.length}/20
              </span>
            </div>
          </AgentFormField>

          <AgentFormField label="ПИНФЛ">
            <input
              value={pinfl}
              onChange={(e) => setPinfl(e.target.value)}
              className={agentModalInputClass}
              placeholder="ПИНФЛ"
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

          <AgentFormField label="Должность">
            {positionOptions.length === 0 ? (
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className={agentModalInputClass}
                placeholder="Должность"
              />
            ) : (
              <AgentFormSelect
                value={position}
                onChange={setPosition}
                emptyLabel="Должность"
                options={positionOptions.map((p) => ({ value: p, label: p }))}
              />
            )}
            {positionOptions.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">Информация не найдена — введите вручную.</p>
            ) : null}
          </AgentFormField>

          <SearchableMultiSelectPanel
            label="Агент"
            searchPlaceholder="Поиск"
            search={agSearch}
            onSearchChange={setAgSearch}
            items={filteredAgents.map((a) => ({
              id: a.id,
              subtitle: a.code != null && String(a.code).trim() !== "" ? String(a.code) : `#${a.id}`,
              title: a.fio
            }))}
            selected={agSel}
            onSelectedChange={setAgSel}
            emptyMessage="Нет агентов"
            triggerClassName="h-[42px] w-full rounded-lg border border-border bg-card px-3 text-sm"
          />

          {inactiveLinked.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-rose-800">
                    Неактивные агенты ({inactiveLinked.length})
                  </p>
                  <p className="mt-0.5 text-xs text-rose-700/90">
                    Привязаны к супервайзеру, но скрыты из списка выше. Открепите их, чтобы очистить
                    связь.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading || detachingInactive}
                  onClick={() => void handleDetachInactive()}
                  className="shrink-0 rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {detachingInactive ? "Открепление…" : "Открепить все"}
                </button>
              </div>
              <div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                {inactiveLinked.slice(0, 12).map((a) => (
                  <span
                    key={a.id}
                    className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200"
                  >
                    {a.fio}
                    {a.code ? ` · ${a.code}` : ""}
                  </span>
                ))}
                {inactiveLinked.length > 12 ? (
                  <span className="rounded-md px-2 py-0.5 text-[11px] text-rose-700">
                    …ещё {inactiveLinked.length - 12}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <AgentFormField label="Авторизоваться">
            <div className="relative">
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value.toLowerCase())}
                maxLength={20}
                disabled={!isNew}
                className={`${agentModalInputClass} pr-14 disabled:bg-muted disabled:text-slate-500 ${inputErr("login")}`}
                placeholder="Логин"
                autoComplete="off"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {login.length}/20
              </span>
            </div>
            {fieldErrors.login ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.login}</p>
            ) : null}
          </AgentFormField>

          <AgentFormField label={isNew ? "Пароль *" : "Пароль"}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${agentModalInputClass} pr-10 ${inputErr("password")}`}
                placeholder={isNew ? "Минимум 6 символов" : "Новый пароль (необязательно)"}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
            ) : null}
            {isNew ? (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-teal-700 hover:text-teal-800"
                onClick={() => {
                  setPassword(randomPassword());
                  setShowPassword(true);
                }}
              >
                Сгенерировать пароль
              </button>
            ) : null}
          </AgentFormField>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
            <span className="text-sm text-slate-700">Выбрать цвет для KPI</span>
            <input
              type="color"
              value={kpi_color}
              onChange={(e) => setKpi(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-card"
            />
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
            <span className="text-sm text-slate-700">Активный</span>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={is_active}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <div
              className={`relative h-6 w-11 rounded-full transition ${is_active ? "bg-teal-500" : "bg-muted"}`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition ${is_active ? "left-[22px]" : "left-0.5"}`}
              />
            </div>
          </label>
        </div>

        <div className="border-t border-border bg-muted/40 px-5 py-4">
          <button
            type="button"
            disabled={loading || !first_name.trim() || (isNew && (!login.trim() || password.length < 6))}
            onClick={() => void handleSave()}
            className="flex w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {loading ? "Сохранение…" : isNew ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
