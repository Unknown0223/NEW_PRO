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
import { FilterSelect } from "@/components/ui/filter-select";
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
  code: "",
  pinfl: "",
  branch: "",
  position: "",
  login: "",
  password: "",
  product: "",
  agent_type: "",
  price_type: "",
  trade_direction_id: "",
  warehouse_id: "",
  return_warehouse_id: "",
  can_authorize: true,
  app_access: true,
  consignment: false,
  work_slot_id: ""
};

const KINDS_WITH_WORK_SLOT = new Set<Kind>(["agent", "expeditor", "collector", "skladchik"]);

function slotTypeForKind(kind: Kind): string {
  if (kind === "skladchik") return "skladchik";
  if (kind === "collector") return "collector";
  if (kind === "expeditor") return "expeditor";
  return "agent";
}

type StaffCreateFormState = typeof emptyForm;

function staffCreateFieldMessageUzbek(field: string): string | undefined {
  if (field === "first_name") return "Ism majburiy.";
  if (field === "login") return "Login majburiy.";
  if (field === "password") return "Parol kamida 6 belgidan iborat bo‘lishi kerak.";
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
  return firstValidationUserHint(flat) ?? "Ma’lumotlarni tekshiring.";
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
  const showWorkSlotPicker = KINDS_WITH_WORK_SLOT.has(kind);

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

  const workSlotsQ = useQuery({
    queryKey: ["work-slots", tenantSlug, kind, "staff-create"],
    enabled: Boolean(tenantSlug) && showWorkSlotPicker,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{
          id: number;
          slot_code: string;
          label: string | null;
          active_user_name: string | null;
        }>;
      }>(
        `/api/${tenantSlug}/work-slots?slot_type=${slotTypeForKind(kind)}&limit=300&is_active=true`
      );
      return data.data ?? [];
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
        code: kind === "supervisor" ? null : form.code.trim() || null,
        pinfl: kind === "supervisor" ? null : form.pinfl.trim() || null,
        branch:
          kind === "supervisor" || workplaceOnWorkSlots ? null : form.branch.trim() || null,
        position: kind === "supervisor" ? null : form.position.trim() || null,
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
        app_access: kind === "supervisor" ? true : form.app_access,
        consignment: kind === "supervisor" || workplaceOnWorkSlots ? false : form.consignment,
        work_slot_id:
          showWorkSlotPicker && form.work_slot_id.trim()
            ? Number.parseInt(form.work_slot_id.trim(), 10)
            : null
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
      setLocalError(Object.values(clientErrors)[0] ?? "Majburiy maydonlarni to‘ldiring.");
      return;
    }
    createMut.mutate();
  };

  const title =
    kind === "agent"
      ? "Yangi agent"
      : kind === "supervisor"
        ? "Yangi supervizor"
        : kind === "collector"
          ? "Yangi inkassator"
          : kind === "auditor"
            ? "Yangi auditor"
          : "Yangi ekseditor";

  if (kind === "supervisor") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
        <PageHeader
          title={title}
          description="Faqat kirish uchun kerakli maydonlar"
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                Orqaga
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={createMut.isPending}
                onClick={submitCreate}
              >
                {createMut.isPending ? "Saqlanmoqda…" : "Qo‘shish"}
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
              placeholder="Ism *"
              value={form.first_name}
              onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
            />
            <FieldHint name="first_name" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1">
            <Input
              placeholder="Familiya"
              value={form.last_name}
              onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
            />
            <FieldHint name="last_name" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1">
            <Input
              placeholder="Telefon"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <FieldHint name="phone" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Input
              className="font-mono w-full"
              placeholder="Login *"
              value={form.login}
              onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
              autoComplete="off"
            />
            <FieldHint name="login" errors={fieldErrors} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Input
              className="w-full"
              placeholder="Parol * (min. 6)"
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
            Tizimga kirish ruxsati
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Agentlar ro‘yxatida «Супервайзер» ustunidan ushbu foydalanuvchini tanlang.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Bekor
          </Button>
          <Button
            onClick={submitCreate}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? "Saqlanmoqda…" : "Qo‘shish"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
      <PageHeader
        title={title}
        description="To‘liq sahifada qo‘shish"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Orqaga
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={createMut.isPending}
              onClick={submitCreate}
            >
              {createMut.isPending ? "Saqlanmoqda…" : "Qo‘shish"}
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

      {showWorkSlotPicker ? (
        <div className="flex flex-col gap-1 sm:col-span-2">
          <FilterSelect
            className="h-10 w-full min-w-0 max-w-none rounded-md border border-input bg-background px-2 text-sm"
            emptyLabel="Рабочее место *"
            aria-label="Рабочее место"
            value={form.work_slot_id}
            onChange={(e) => setForm((p) => ({ ...p, work_slot_id: e.target.value }))}
          >
            {(workSlotsQ.data ?? [])
              .filter((s) => !s.active_user_name)
              .map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.slot_code}
                  {s.label ? ` — ${s.label}` : ""}
                </option>
              ))}
          </FilterSelect>
          <FieldHint name="work_slot_id" errors={fieldErrors} />
        </div>
      ) : null}

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
          <Input placeholder="Код" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
          <FieldHint name="code" errors={fieldErrors} />
        </div>
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
          <Input
            placeholder="Должность"
            value={form.position}
            onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
          />
          <FieldHint name="position" errors={fieldErrors} />
        </div>
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
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.app_access}
              onChange={(e) => setForm((p) => ({ ...p, app_access: e.target.checked }))}
            />
            Доступ к приложение
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Bekor
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
