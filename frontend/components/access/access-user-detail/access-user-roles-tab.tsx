"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Plus, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { api } from "@/lib/api";
import { accessRoleLabel } from "@/lib/access-role-label";
import { formatOpsCount } from "@/lib/access-history-summary";
import { treeKeys } from "@/lib/access-operations-tree";
import { useAccessToast } from "@/components/access/permission-tree/access-save-bar";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { userMessageAfterAccessPatchFailure, type AccessRoleDefaultRow } from "./access-user-detail.types";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

/** «Роли»: asosiy rol (o'zgartirilmaydi) + qo'shimcha rol guruhlari (operatsiyalar paketi). */
export function AccessUserRolesTab({ vm, readOnly }: { vm: AccessUserDetailVm; readOnly: boolean }) {
  const detail = vm.detailQ.data;
  const { confirm, dialog } = useAppConfirm();
  const toast = useAccessToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const rolesQ = useQuery({
    queryKey: ["access-role-defaults", vm.tenantSlug],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: AccessRoleDefaultRow[] }>(`/api/${vm.tenantSlug}/access/role-defaults`);
      return data.data;
    }
  });
  const byKey = new Map((rolesQ.data ?? []).map((r) => [r.key, r] as const));
  const extra = detail?.extra_role_keys ?? [];
  const treeQ = useAccessOperationsTree(vm.tenantSlug);
  const fromRole = useMemo(() => {
    const keys = new Set(treeKeys(treeQ.data ?? []));
    return (detail?.matrix ?? []).filter((r) => r.from_role && r.effective && keys.has(r.key)).length;
  }, [treeQ.data, detail?.matrix]);
  const role = vm.user?.role ?? "";

  const remove = async (key: string) => {
    const name = byKey.get(key)?.name || key;
    const ok = await confirm({
      title: "Открепить роль",
      message: `Открепить группу операций «${name}» от пользователя?`,
      detail: "Операции этой группы пропадут, если они не выданы другим способом.",
      confirmLabel: "Открепить",
      cancelLabel: "Отмена",
      destructive: true
    });
    if (!ok) return;
    setBusyKey(key);
    try {
      await vm.patchMut.mutateAsync({ extra_role_keys: extra.filter((k) => k !== key) });
      await vm.detailQ.refetch();
      toast.show({ tone: "ok", text: `Роль «${name}» откреплена` });
    } catch (err) {
      toast.show({ tone: "err", text: "Не удалось открепить роль", detail: userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз.") });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain">
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <ShieldCheck className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Основная роль</p>
          <p className="text-sm font-semibold">{accessRoleLabel(role)}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          Из роли: <b className="tabular-nums text-foreground">{formatOpsCount(fromRole)}</b>
        </span>
        <Link href="/access/role-defaults" className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300">
          Состав роли
        </Link>
      </section>

      <section className="flex min-h-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Дополнительные роли</h3>
            <p className="text-xs text-muted-foreground">Готовые группы операций, добавленные к основной роли пользователя.</p>
          </div>
          {!readOnly ? (
            <Button type="button" size="sm" className="h-8 gap-1 bg-teal-700 text-xs text-white hover:bg-teal-800" onClick={() => vm.openModal("role_packs")}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Прикрепить роли
            </Button>
          ) : null}
        </div>
        {extra.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            <p className="text-sm text-muted-foreground">Дополнительные роли не прикреплены</p>
          </div>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {extra.map((key) => {
              const r = byKey.get(key);
              return (
                <li key={key} className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2">
                  <Layers className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{r?.name || key}</p>
                    {r ? <p className="text-[11px] text-muted-foreground">{formatOpsCount(r.operations_count)}</p> : null}
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      disabled={busyKey != null}
                      onClick={() => void remove(key)}
                      className="rounded p-1 text-muted-foreground hover:bg-rose-100 hover:text-rose-700 disabled:opacity-40 dark:hover:bg-rose-950"
                      aria-label={`Открепить роль ${r?.name || key}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {dialog}
      {toast.node}
    </div>
  );
}
