"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useEffect, useState } from "react";

type TenantProfile = {
  name: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  feature_flags: Record<string, unknown>;
  references: {
    payment_types: string[];
    regions: string[];
  };
};

function splitLines(s: string): string[] {
  return s
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

export default function CompanySettingsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [ordersSse, setOrdersSse] = useState(true);
  const [payTypes, setPayTypes] = useState("");
  const [regions, setRegions] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [serverFieldErrs, setServerFieldErrs] = useState<Record<string, string>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ["settings", "profile", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data: body } = await api.get<TenantProfile>(`/api/${tenantSlug}/settings/profile`);
      return body;
    }
  });

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setPhone(data.phone ?? "");
    setAddress(data.address ?? "");
    setLogoUrl(data.logo_url ?? "");
    setOrdersSse(data.feature_flags?.orders_sse !== false);
    setPayTypes(data.references.payment_types.join("\n"));
    setRegions(data.references.regions.join("\n"));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("no");
      const pay = splitLines(payTypes);
      const regs = splitLines(regions);
      const references: Record<string, string[]> = {};
      /** Bo‘sh massiv yuborilmasin — spravochnik o‘chib ketmasin. */
      if (pay.length > 0) references.payment_types = pay;
      if (regs.length > 0) references.regions = regs;
      const { data: body } = await api.patch<TenantProfile>(`/api/${tenantSlug}/settings/profile`, {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl.trim() || null,
        feature_flags: { orders_sse: ordersSse },
        ...(Object.keys(references).length > 0 ? { references } : {})
      });
      return body;
    },
    onMutate: () => {
      setServerFieldErrs({});
      setMsg(null);
    },
    onSuccess: (p) => {
      void qc.setQueryData(["settings", "profile", tenantSlug], p);
      setServerFieldErrs({});
      setMsg("Сохранено.");
    },
    onError: (e: unknown) => {
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          const per = firstMessagePerField(flat);
          setServerFieldErrs(per);
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
          setMsg(line ? withApiSupportLine(line, e) : getUserFacingError(e, "Ошибка сохранения или нет доступа."));
          return;
        }
        setServerFieldErrs({});
      } else {
        setServerFieldErrs({});
      }
      setMsg(getUserFacingError(e, "Ошибка сохранения или нет доступа."));
    }
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Компания и флаги</h1>
        <p className="text-sm text-muted-foreground">Компания: {tenantSlug ?? "—"}</p>
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/dashboard">
          ← Дашборд
        </Link>
      </div>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Сессия…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти
          </Link>
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Ошибка загрузки профиля.</p>
      ) : (
        <div className="grid gap-4 rounded-lg border p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="co-name">Название компании</Label>
            <Input
              id="co-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin || saveMut.isPending}
            />
            {pickZodLeaf(serverFieldErrs, "name") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "name")}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="co-phone">Телефон</Label>
            <Input
              id="co-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!isAdmin || saveMut.isPending}
            />
            {pickZodLeaf(serverFieldErrs, "phone") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "phone")}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="co-addr">Адрес</Label>
            <Input
              id="co-addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!isAdmin || saveMut.isPending}
            />
            {pickZodLeaf(serverFieldErrs, "address") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "address")}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="co-logo">URL логотипа</Label>
            <Input
              id="co-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={!isAdmin || saveMut.isPending}
            />
            {pickZodLeaf(serverFieldErrs, "logo_url") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "logo_url")}</p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ordersSse}
              onChange={(e) => setOrdersSse(e.target.checked)}
              disabled={!isAdmin || saveMut.isPending}
            />
            Заказы SSE (обновление в реальном времени)
          </label>
          {pickZodLeaf(serverFieldErrs, "orders_sse") || pickZodLeaf(serverFieldErrs, "feature_flags") ? (
            <p className="text-xs text-destructive">
              {pickZodLeaf(serverFieldErrs, "orders_sse") ?? pickZodLeaf(serverFieldErrs, "feature_flags")}
            </p>
          ) : null}
          <p className="text-xs font-medium text-muted-foreground">Дополнительные справочники (каждое значение с новой строки или через запятую)</p>
          <p className="text-xs text-muted-foreground">
            Управление способами оплаты через таблицу:{" "}
            <Link href="/settings/payment-methods" className="text-primary underline">
              /settings/payment-methods
            </Link>
            . Здесь сохраняется старый текстовый список (для обратной совместимости).
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="co-pay">Способы оплаты</Label>
            <textarea
              id="co-pay"
              className="min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm"
              value={payTypes}
              onChange={(e) => setPayTypes(e.target.value)}
              disabled={!isAdmin || saveMut.isPending}
            />
            {pickZodLeaf(serverFieldErrs, "payment_types") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "payment_types")}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label>Причины возврата / отказа</Label>
            <p className="text-xs text-muted-foreground">
              Управляются через таблицу (то же, что «Причины отказа» в каталоге):{" "}
              <Link href="/settings/reasons/refusal-reasons" className="text-primary underline">
                /settings/reasons/refusal-reasons
              </Link>
              .
            </p>
          </div>
          <div id="ref-regions" className="scroll-mt-20 grid gap-1.5">
            <Label htmlFor="co-reg">Территории (область / территория)</Label>
            <p className="text-xs text-muted-foreground">
              Выбор «Территория» в карточке клиента заполняется из этого списка.
            </p>
            <textarea
              id="co-reg"
              className="min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm"
              value={regions}
              onChange={(e) => setRegions(e.target.value)}
              disabled={!isAdmin || saveMut.isPending}
            />
            {pickZodLeaf(serverFieldErrs, "regions") ? (
              <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "regions")}</p>
            ) : null}
          </div>
          {isAdmin ? (
            <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? "Сохранение…" : "Сохранить"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Редактирование только для администратора.</p>
          )}
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
        </div>
      )}
    </div>
  );
}
