"use client";

import { useEffect, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { firstMessagePerField, firstValidationUserHint, getZodFlattenFromApiErrorBody, type ZodFlattenDetails } from "@/lib/api-validation-details";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { withApiSupportLine } from "@/lib/error-utils";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";

type Kind = "agent" | "expeditor" | "supervisor" | "collector" | "auditor" | "skladchik";

type Props = {
  kind: Kind;
  tenantSlug: string;
  onSuccess: () => void;
  onCancel: () => void;
};

type TenantProfile = {
  references: {
    branches?: Array<{ id: string; name: string; active?: boolean }>;
  };
};

function FieldHint({ name, errors }: { name: string; errors: Record<string, string> }) {
  const t = errors[name];
  if (!t) return null;
  return <p className="text-xs text-destructive">{t}</p>;
}

const emptyForm = {
  first_name: "",
  last_name: "",
  middle_name: "",
  phone: "",
  territory: "",
  pinfl: "",
  branch: "",
  login: "",
  password: "",
  product: "",
  agent_type: "",
  price_type: "",
  trade_direction_id: "",
  warehouse_id: "",
  return_warehouse_id: "",
  can_authorize: true,
  consignment: false
};

type StaffCreateFormState = typeof emptyForm;

function staffCreateFieldMessageUzbek(field: string): string | undefined {
  if (field === "first_name") return "Имя обязательно.";
  if (field === "login") return "Логин обязателен.";
  if (field === "password") return "Пароль должен содержать не менее 6 символов.";
  return undefined;
}

function staffCreateFieldErrorsFromApi(flat: ZodFlattenDetails): Record<string, string> {
  const raw = firstMessagePerField(flat);
  const out: Record<string, string> = {};
  for (const [key, msg] of Object.entries(raw)) {
    out[key] = staffCreateFieldMessageUzbek(key) ?? msg;
  }
  return out;
}

function staffCreateValidationBanner(flat: ZodFlattenDetails): string {
  const per = staffCreateFieldErrorsFromApi(flat);
  for (const key of ["first_name", "login", "password"]) {
    if (per[key]) return per[key];
  }
  return firstValidationUserHint(flat) ?? "Проверьте данные.";
}

function validateStaffCreateForm(form: StaffCreateFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.first_name.trim()) errors.first_name = staffCreateFieldMessageUzbek("first_name")!;
  if (!form.login.trim()) errors.login = staffCreateFieldMessageUzbek("login")!;
  if (form.password.length < 6) errors.password = staffCreateFieldMessageUzbek("password")!;
  return errors;
}

export function StaffCreateForm({ kind, tenantSlug, onSuccess, onCancel }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Склад, филиал, направление — только в Рабочее место */
  const workplaceOnWorkSlots =
    kind === "agent" ||
    kind === "expeditor" ||
    kind === "collector" ||
    kind === "skladchik" ||
    kind === "auditor";

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "staff-create"],
    enabled: kind !== "supervisor" && !workplaceOnWorkSlots,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(`/api/${tenantSlug}/warehouses`);
      return data.data;
    }
  });

  const branchesQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "staff-create-branches"],
    enabled: Boolean(tenantSlug) && kind !== "supervisor" && !workplaceOnWorkSlots,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<TenantProfile>(`/api/${tenantSlug}/settings/profile`);
      return (data.references.branches ?? []).filter((b) => b.active !== false);
    }
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const path =
        kind === "agent"
          ? "agents"
          : kind === "supervisor"
            ? "supervisors"
            : kind === "collector"
              ? "collectors"
              : kind === "auditor"
                ? "auditors"
              : "expeditors";
      await api.post(`/api/${tenantSlug}/${path}`, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        middle_name: form.middle_name.trim() || null,
        phone: form.phone.trim() || null,
        territory:
          kind === "supervisor" || workplaceOnWorkSlots ? null : form.territory.trim() || null,
        pinfl: kind === "supervisor" ? null : form.pinfl.trim() || null,
        branch:
          kind === "supervisor" || workplaceOnWorkSlots ? null : form.branch.trim() || null,
        login: form.login.trim(),
        password: form.password,
        product: kind === "supervisor" ? null : form.product || null,
        agent_type: kind === "supervisor" ? null : form.agent_type || null,
        price_type: kind === "supervisor" || kind === "agent" ? null : form.price_type || null,
        trade_direction_id:
          kind === "supervisor" || workplaceOnWorkSlots
            ? null
            : form.trade_direction_id.trim()
              ? Number.parseInt(form.trade_direction_id.trim(), 10)
              : null,
        warehouse_id:
          kind === "supervisor" || workplaceOnWorkSlots
            ? null
            : form.warehouse_id
              ? Number.parseInt(form.warehouse_id, 10)
              : null,
        return_warehouse_id:
          kind === "supervisor" || workplaceOnWorkSlots
            ? null
            : form.return_warehouse_id
              ? Number.parseInt(form.return_warehouse_id, 10)
              : null,
        can_authorize: form.can_authorize,
        consignment: kind === "supervisor" || workplaceOnWorkSlots ? false : form.consignment
      });
    },
    onSuccess: async () => {
      setLocalError(null);
      setFieldErrors({});
      await qc.invalidateQueries({ queryKey: [kind, tenantSlug] });
      if (kind === "supervisor") {
        await qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug, "clients-toolbar"] });
      }
      setForm(emptyForm);
      onSuccess();
    },
    onError: (e: Error) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        setFieldErrors(staffCreateFieldErrorsFromApi(flat));
        setLocalError(withApiSupportLine(staffCreateValidationBanner(flat), e));
      } else {
        setFieldErrors({});
        setLocalError(messageFromStaffCreateError(e));
      }
    }
  });

  const submitCreate = () => {
    setLocalError(null);
    setFieldErrors({});
    const clientErrors = validateStaffCreateForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setLocalError(Object.values(clientErrors)[0] ?? "Заполните обязательные поля.");
      return;
    }
    createMut.mutate();
  };

  const title =
    kind === "agent"
      ? "Новый агент"
      : kind === "supervisor"
        ? "Новый супервайзер"
        : kind === "collector"
          ? "Новый инкассатор"
          : kind === "auditor"
            ? "Новый аудитор"
          : "Новый экспедитор";

  if (kind === "supervisor") {
    return (
      <div className="flex w-full flex-col gap-6 pb-10">
        <PageHeader
          title={title}
          description="Только поля, необходимые для входа"
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                Назад
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={createMut.isPending}
                onClick={submitCreate}
              >
                {createMut.isPending ? "Сохранение…" : "Добавить"}
              </Button>
            </div>
          }
        />
        {localError ? (
          <p className="text-sm text-destructive" role="alert">
            {localError}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Input
              className="w-full"
              placeholder="Имя *"
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
            />
            <FieldHint name="first_name" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1">
            <Input
              placeholder="Фамилия"
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
            />
            <FieldHint name="last_name" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1">
            <Input
              placeholder="Телефон"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <FieldHint name="phone" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Input
              className="font-mono w-full"
              placeholder="Логин *"
              value={form.login}
              onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
              autoComplete="off"
            />
            <FieldHint name="login" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Input
              className="w-full"
              placeholder="Пароль * (мин. 6)"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              autoComplete="new-password"
            />
            <FieldHint name="password" errors={fieldErrors} />
          </div>
          <label className="inline-flex items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              checked={form.can_authorize}
              onChange={(e) => setForm((p) => ({ ...p, can_authorize: e.target.checked }))}
            />
            Доступ для входа в систему
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Выберите этого пользователя в столбце «Супервайзер» списка агентов.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            onClick={submitCreate}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? "Сохранение…" : "Добавить"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-10">
      <PageHeader
        title={title}
        description="Добавление на отдельной странице"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Назад
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={createMut.isPending}
              onClick={submitCreate}
            >
              {createMut.isPending ? "Сохранение…" : "Добавить"}
            </Button>
          </div>
        }
      />

      {localError ? (
        <p className="text-sm text-destructive" role="alert">
          {localError}
        </p>
      ) : null}

      {workplaceOnWorkSlots ? <WorkplaceMovedNotice /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Имя"
            value={form.first_name}
            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
          />
          <FieldHint name="first_name" errors={fieldErrors} />
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Фамилия"
            value={form.last_name}
            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
          />
          <FieldHint name="last_name" errors={fieldErrors} />
        </div>
        <div className="flex flex-col gap-1">
          <Input placeholder="Отчество" value={form.middle_name} onChange={(e) => setForm((p) => ({ ...p, middle_name: e.target.value }))} />
          <FieldHint name="middle_name" errors={fieldErrors} />
        </div>
        <div className="flex flex-col gap-1">
          <Input placeholder="Телефон" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <FieldHint name="phone" errors={fieldErrors} />
        </div>
        {!workplaceOnWorkSlots ? (
          <div className="flex flex-col gap-1">
            <Input
              placeholder="Территория"
              value={form.territory}
              onChange={(e) => setForm((p) => ({ ...p, territory: e.target.value }))}
            />
            <FieldHint name="territory" errors={fieldErrors} />
          </div>
        ) : null}
        {!workplaceOnWorkSlots ? (
          <div className="flex flex-col gap-1">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={form.warehouse_id}
              onChange={(e) => setForm((p) => ({ ...p, warehouse_id: e.target.value }))}
            >
              <option value="">Склад</option>
              {(warehousesQ.data ?? []).map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>
            <FieldHint name="warehouse_id" errors={fieldErrors} />
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <Input placeholder="ПИНФЛ" value={form.pinfl} onChange={(e) => setForm((p) => ({ ...p, pinfl: e.target.value }))} />
          <FieldHint name="pinfl" errors={fieldErrors} />
        </div>
        {!workplaceOnWorkSlots ? (
          <div className="flex flex-col gap-1">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={form.branch}
              onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
            >
              <option value="">Филиал</option>
              {(branchesQ.data ?? []).map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
            <FieldHint name="branch" errors={fieldErrors} />
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <Input placeholder="Логин" value={form.login} onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))} />
          <FieldHint name="login" errors={fieldErrors} />
        </div>
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Пароль"
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          />
          <FieldHint name="password" errors={fieldErrors} />
        </div>
        {kind === "agent" ? (
          <>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Продукт"
                value={form.product}
                onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}
              />
              <FieldHint name="product" errors={fieldErrors} />
            </div>
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Тип агента"
                value={form.agent_type}
                onChange={(e) => setForm((p) => ({ ...p, agent_type: e.target.value }))}
              />
              <FieldHint name="agent_type" errors={fieldErrors} />
            </div>
          </>
        ) : null}
        <div className="flex items-center justify-between text-xs sm:col-span-2">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.can_authorize}
              onChange={(e) => setForm((p) => ({ ...p, can_authorize: e.target.checked }))}
            />
            Активный
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            onClick={submitCreate}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? "Сохранение..." : "Добавить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
