"use client";

import type { AxiosError } from "axios";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { firstMessagePerField, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { withApiSupportLine } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
import { WEB_PANEL_ACCESS_ROLE_OPTIONS } from "@/lib/distribution-roles";
import { WorkplaceMovedNotice } from "@/components/staff/workplace-moved-notice";

function FieldHint({ name, errors }: { name: string; errors: Record<string, string> }) {
  const t = errors[name];
  if (!t) return null;
  return <p className="text-xs text-destructive">{t}</p>;
}

type Props = {
  tenantSlug: string;
  /** `embedded` — modal ichida; `page` — to‘liq sahifa (default). */
  layout?: "page" | "embedded";
  /** `layout="embedded"`: muvaffaqiyatdan keyin (masalan modal yopish). */
  onCreated?: () => void;
  /** `layout="embedded"`: Bekor. */
  onCancel?: () => void;
};

export function WebOperatorCreateWorkspace({
  tenantSlug,
  layout = "page",
  onCreated,
  onCancel
}: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    login: "",
    password: "",
    phone: "",
    email: "",
    pinfl: "",
    can_authorize: true,
    web_access_role: "operator" as (typeof WEB_PANEL_ACCESS_ROLE_OPTIONS)[number]["value"]
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const createMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        middle_name: form.middle_name.trim() || null,
        login: form.login.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        pinfl: form.pinfl.trim() || null,
        can_authorize: form.can_authorize,
        is_active: true
      };
      if (form.web_access_role !== "operator") {
        body.web_access_role = form.web_access_role;
      }
      await api.post(`/api/${tenantSlug}/operators`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
      setFieldErrors({});
      if (layout === "embedded") {
        onCreated?.();
      } else {
        router.push("/settings/spravochnik/operators");
      }
    },
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        setFieldErrors(firstMessagePerField(flat));
        const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
        setLocalError(top ? withApiSupportLine(top, e) : null);
      } else {
        setFieldErrors({});
        setLocalError(messageFromStaffCreateError(e));
      }
    }
  });

  const submitCreate = () => {
    setLocalError(null);
    setFieldErrors({});
    createMut.mutate();
  };

  const formCard = (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-5 text-sm shadow-sm sm:p-6">
          <WorkplaceMovedNotice />
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Имя *</span>
            <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            <FieldHint name="first_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Фамилия</span>
            <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            <FieldHint name="last_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Отчество</span>
            <Input
              value={form.middle_name}
              onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))}
            />
            <FieldHint name="middle_name" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Системная роль *</span>
            <select
              className={cn(filterSelectClassName, "h-10 w-full max-w-none")}
              aria-label="Системная роль"
              value={form.web_access_role}
              onChange={(e) => {
                const v = e.target.value as (typeof form)["web_access_role"];
                setForm((f) => ({ ...f, web_access_role: v }));
              }}
            >
              {WEB_PANEL_ACCESS_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FieldHint name="web_access_role" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Логин *</span>
            <Input
              className="font-mono"
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              autoComplete="off"
            />
            <FieldHint name="login" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Пароль * (мин. 6)</span>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
            <FieldHint name="password" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Телефон</span>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <FieldHint name="phone" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Email</span>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <FieldHint name="email" errors={fieldErrors} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">ПИНФЛ</span>
            <Input value={form.pinfl} onChange={(e) => setForm((f) => ({ ...f, pinfl: e.target.value }))} />
            <FieldHint name="pinfl" errors={fieldErrors} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.can_authorize}
              onChange={(e) => setForm((f) => ({ ...f, can_authorize: e.target.checked }))}
            />
            Разрешить вход в систему
          </label>
        </div>
  );

  const errorAlert =
    localError != null ? (
      <p className="text-sm text-destructive" role="alert">
        {localError}
      </p>
    ) : null;

  const embeddedFooter = (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={() => onCancel?.()} disabled={createMut.isPending}>
        Отмена
      </Button>
      <Button type="button" disabled={createMut.isPending} onClick={submitCreate}>
        {createMut.isPending ? "…" : "Создать"}
      </Button>
    </div>
  );

  if (layout === "embedded") {
    return (
      <div className="space-y-4">
        {errorAlert}
        {formCard}
        {embeddedFooter}
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Новый веб-сотрудник"
        description="Логин и пароль должны быть уникальными."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/settings/spravochnik/operators"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              ← К списку
            </Link>
            <Button
              type="button"
              size="sm"
              disabled={createMut.isPending}
              onClick={submitCreate}
            >
              {createMut.isPending ? "…" : "Создать"}
            </Button>
          </div>
        }
      />

      <div className="w-full space-y-6 pb-24">
        {errorAlert}
        {formCard}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/settings/spravochnik/operators")}>
            Отмена
          </Button>
          <Button type="button" disabled={createMut.isPending} onClick={submitCreate}>
            {createMut.isPending ? "…" : "Создать"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
