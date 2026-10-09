"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, X } from "lucide-react";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { messageFromSupervisorPatchError } from "@/lib/staff-api-errors";
import {
  AgentFormField,
  agentModalInputClass,
  parseAgentFio
} from "@/components/staff/agent-workspace-template-ui";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";
import { StaffFaceReferencePanel } from "@/components/staff/staff-face-reference-panel";

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
  work_slot_id?: number | null;
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
  positionSuggestions?: string[];
  loading: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmitCreate: (body: Record<string, unknown>) => void;
  onSubmitEdit: (id: number, body: Record<string, unknown>) => Promise<unknown>;
};

export function SupervisorFormModal({
  mode,
  open,
  row,
  tenantSlug,
  branchOptions: _branchOptions,
  positionSuggestions: _positionSuggestions,
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
  const [pinfl, setPinfl] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [kpi_color, setKpi] = useState("#0d9488");
  const [is_active, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      setPinfl("");
      setLogin("");
      setPassword(randomPassword());
      setShowPassword(true);
      setKpi("#0d9488");
      setIsActive(true);
      return;
    }
    if (!r) return;
    const parsed = parseAgentFio(r.fio);
    setFirst((r.first_name ?? "").trim() || parsed.first);
    setLast((r.last_name ?? "").trim() || parsed.last);
    setMid((r.middle_name ?? "").trim() || parsed.middle);
    setPhone(r.phone ?? "");
    setPinfl(r.pinfl ?? "");
    setLogin(r.login);
    setPassword("");
    setShowPassword(false);
    setKpi(r.kpi_color || "#0d9488");
    setIsActive(r.is_active);
  }, [open, isNew, r]);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!first_name.trim()) errs.first_name = "Имя обязательно.";
    if (!login.trim()) errs.login = "Логин обязателен.";
    if (isNew) {
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
      pinfl: pinfl.trim() || null,
      kpi_color: kpi_color || null,
      is_active,
      can_authorize: is_active
    };
    if (isNew) {
      onSubmitCreate({
        ...body,
        login: login.trim().toLowerCase(),
        password
      });
      return;
    }
    if (!r) return;
    body.login = login.trim().toLowerCase();
    if (password.trim().length >= 6) body.password = password.trim();
    try {
      await onSubmitEdit(r.id, body);
      onClose();
    } catch (e: unknown) {
      setFieldErrors({ login: messageFromSupervisorPatchError(e) });
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

          <WorkplaceMovedNotice
            variant="supervisor"
            workSlotId={r?.work_slot_id}
            openConfig={Boolean(r?.work_slot_id)}
          />

          <StaffFaceReferencePanel
            tenantSlug={tenantSlug}
            userId={r?.id ?? 0}
            enabled={!isNew && Boolean(r?.id)}
            displayName={
              [last_name, first_name, middle_name].filter(Boolean).join(" ") || r?.fio
            }
          />

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

          <AgentFormField label="ПИНФЛ">
            <input
              value={pinfl}
              onChange={(e) => setPinfl(e.target.value)}
              className={agentModalInputClass}
              placeholder="ПИНФЛ"
            />
          </AgentFormField>

          <AgentFormField label="Логин *">
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className={`${agentModalInputClass} ${inputErr("login")}`}
              placeholder="login"
              autoComplete="username"
            />
            {fieldErrors.login ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.login}</p>
            ) : null}
          </AgentFormField>

          <AgentFormField label={isNew ? "Пароль *" : "Новый пароль"}>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${agentModalInputClass} pr-10 ${inputErr("password")}`}
                placeholder={isNew ? "Пароль" : "Оставьте пустым, чтобы не менять"}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
            ) : null}
          </AgentFormField>

          <AgentFormField label="Цвет KPI">
            <input
              type="color"
              value={kpi_color || "#0d9488"}
              onChange={(e) => setKpi(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-border bg-card px-1"
            />
          </AgentFormField>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={is_active}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-teal-600"
            />
            Активен
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-muted"
            disabled={loading}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
