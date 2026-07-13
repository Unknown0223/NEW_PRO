"use client";

import Link from "next/link";
import { useState } from "react";
import { SoftVoidConfirmDialog } from "@/components/shared/soft-void-confirm-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { AccessWorkspaceLeftPanel } from "./access-workspace-left-panel";
import { AccessWorkspaceOperationsPanel } from "./access-workspace-operations-panel";
import { AccessWorkspaceScopePanel } from "./access-workspace-scope-panel";
import { AccessWorkspaceUserPickerModal } from "./access-workspace-user-picker-modal";
import { AccessUserDetailPanel } from "@/components/access/access-user-detail-panel";
import { useAccessWorkspace } from "./use-access-workspace";
import { isScopeDimensionTab } from "./access-workspace.shared";

const ACCESS_RESET_CONSEQUENCES = [
  "Персональные разрешения и доп. роли будут сброшены к роли по умолчанию",
  "Снимок текущих прав сохраняется в журнале доступа",
  "Восстановление возможно через restore-reset по последнему снимку"
];

export function AccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const ws = useAccessWorkspace({ tenantSlug });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  return (
    <div className="access-surface flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 p-3">
      <div className="access-hub-toolbar w-full shrink-0">
        <div className="flex flex-wrap gap-1">
          {[
            { key: "users", label: "Пользователи" },
            { key: "operations", label: "Операции" },
            { key: "cash_desks", label: "Кассы" },
            { key: "warehouses", label: "Склады" },
            { key: "branches", label: "Филиалы" },
            { key: "payment_methods", label: "Способы оплаты" },
            { key: "trade_directions", label: "Направления" }
          ].map((x) => (
            <button
              key={x.key}
              data-active={ws.tab === x.key}
              className={`access-tab-chip ${ws.tab === x.key ? "" : "text-muted-foreground hover:bg-muted/50"}`}
              onClick={() => {
                ws.setTab(x.key as typeof ws.tab);
                ws.startListNavTransition(() => ws.setSelectedKey(null));
              }}
              type="button"
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/access/role-defaults" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs no-underline")}>
            Состав ролей по умолчанию
          </Link>
          <Link href="/access/history" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs no-underline")}>
            История изменения доступов
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch">
        <AccessWorkspaceLeftPanel ws={ws} />
        <div className="access-right-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {ws.tab === "users" && ws.selected ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <AccessUserDetailPanel
                tenantSlug={ws.tenantSlug}
                userId={ws.selected.id}
                onInvalidateUsers={ws.scheduleAccessUsersListRefresh}
                userAccountControls={{
                  isActive: ws.selected.status === "active",
                  onToggle: () => void ws.toggleMut.mutateAsync(ws.selected!),
                  onReset: (id) => {
                    if (id !== ws.selected!.id) return;
                    setResetError(null);
                    setResetConfirmOpen(true);
                  },
                  togglePending: ws.toggleMut.isPending && ws.toggleMut.variables?.id === ws.selected!.id,
                  resetPending: ws.resetMut.isPending && ws.resetMut.variables === ws.selected!.id
                }}
              />
            </div>
          ) : ws.tab !== "users" && ws.selectedDimension ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden overscroll-contain p-3 sm:p-4">
              {ws.dimensionUsersApiMissing ? (
                <div className="shrink-0 rounded-md border border-border/60 bg-card p-3 shadow-sm sm:p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    API dimensions/users пока недоступен в текущем backend runtime. Перезапустите backend dev-процесс.
                  </p>
                </div>
              ) : null}
              {ws.tab === "operations" ? <AccessWorkspaceOperationsPanel ws={ws} /> : null}
              {isScopeDimensionTab(ws.tab) ? (
                <AccessWorkspaceScopePanel ws={ws} />
              ) : null}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {ws.tab === "users" && ws.selectedKey && !ws.selected
                  ? "Пользователь не найден в списке (обновите поиск или фильтр)."
                  : `Выберите запись в «${ws.activeTabLabel}» слева.`}
              </p>
            </div>
          )}
        </div>
      </div>
      <AccessWorkspaceUserPickerModal ws={ws} />

      <SoftVoidConfirmDialog
        open={resetConfirmOpen}
        onClose={() => {
          if (ws.resetMut.isPending) return;
          setResetConfirmOpen(false);
          setResetError(null);
        }}
        onConfirm={async () => {
          if (!ws.selected) return;
          try {
            setResetError(null);
            await ws.resetMut.mutateAsync(ws.selected.id);
            setResetConfirmOpen(false);
          } catch {
            setResetError("Не удалось сбросить доступ.");
          }
        }}
        title="Сбросить права доступа"
        description={
          ws.selected
            ? `Сбросить персональные права пользователя «${ws.selected.login ?? ws.selected.id}» к роли по умолчанию?`
            : "Сбросить персональные права к роли по умолчанию?"
        }
        reasonRequired={false}
        reasonPlaceholder="Комментарий (необязательно)"
        confirmLabel="Сбросить"
        pending={ws.resetMut.isPending}
        error={resetError}
        consequences={ACCESS_RESET_CONSEQUENCES}
      />
    </div>
  );
}
