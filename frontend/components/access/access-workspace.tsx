"use client";

import Link from "next/link";
import { useCallback, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { History, Settings2, UserRoundSearch } from "lucide-react";
import { SoftVoidConfirmDialog } from "@/components/shared/soft-void-confirm-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { AccessWorkspaceLeftPanel } from "./access-workspace-left-panel";
import { AccessWorkspaceOperationsPanel } from "./access-workspace-operations-panel";
import { AccessWorkspaceScopePanel } from "./access-workspace-scope-panel";
import { AccessWorkspaceUserPickerModal } from "./access-workspace-user-picker-modal";
import { AccessEntityRoleLinkModal } from "./access-entity-role-link-modal";
import { AccessUserDetailPanel } from "@/components/access/access-user-detail-panel";
import type { AccessLeaveGuard } from "@/components/access/access-user-detail/access-user-detail-panel-view";
import { AccessUsersSidebar } from "./access-users-sidebar";
import { useAccessWorkspace } from "./use-access-workspace";
import { isScopeDimensionTab } from "./access-workspace.shared";

type WorkspaceTab = ReturnType<typeof useAccessWorkspace>["tab"];

const WORKSPACE_TABS: { key: WorkspaceTab; label: string }[] = [
  { key: "users", label: "Пользователи" },
  { key: "operations", label: "Операции" },
  { key: "cash_desks", label: "Кассы" },
  { key: "warehouses", label: "Склады" },
  { key: "branches", label: "Филиалы" },
  { key: "payment_methods", label: "Способ оплаты" },
  { key: "trade_directions", label: "Направления" }
];

const ACCESS_RESET_CONSEQUENCES = [
  "Персональные разрешения и доп. роли будут сброшены к роли по умолчанию",
  "Снимок текущих прав сохраняется в журнале доступа",
  "Восстановление возможно через restore-reset по последнему снимку"
];

export function AccessWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const ws = useAccessWorkspace({ tenantSlug });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [leaveGuard, setLeaveGuardState] = useState<AccessLeaveGuard | null>(null);
  const setLeaveGuard = useCallback((g: AccessLeaveGuard | null) => setLeaveGuardState(() => g), []);
  const runGuarded = (action: () => void) => (leaveGuard ? leaveGuard(action) : action());
  const router = useRouter();
  const guardLink = (e: MouseEvent, href: string) => {
    if (!leaveGuard) return;
    e.preventDefault();
    leaveGuard(() => router.push(href));
  };
  const selectedUserId =
    ws.tab === "users" && ws.selectedKey && Number.isFinite(Number(ws.selectedKey)) ? Number(ws.selectedKey) : null;

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-3">
      <header className="shrink-0 space-y-2.5 rounded-xl border border-border/70 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight">Доступ</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/access/role-defaults"
              onClick={(e) => guardLink(e, "/access/role-defaults")}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs no-underline")}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              Состав ролей по умолчанию
            </Link>
            <Link
              href="/access/history"
              onClick={(e) => guardLink(e, "/access/history")}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs no-underline")}
            >
              <History className="h-3.5 w-3.5" aria-hidden />
              История изменения доступов
            </Link>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1" role="tablist" aria-label="Разделы доступа">
          {WORKSPACE_TABS.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={ws.tab === x.key}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                ws.tab === x.key ? "bg-teal-700 text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() =>
                runGuarded(() => {
                  ws.setTab(x.key);
                  ws.startListNavTransition(() => ws.setSelectedKey(null));
                })
              }
            >
              {x.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch">
        {ws.tab === "users" ? (
          <AccessUsersSidebar
            ws={ws}
            selectedId={selectedUserId}
            onSelect={(id) => runGuarded(() => ws.selectSideRowKey(String(id)))}
          />
        ) : (
          <AccessWorkspaceLeftPanel ws={ws} />
        )}
        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", ws.tab !== "users" && "access-right-panel")}>
          {ws.tab === "users" && selectedUserId ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <AccessUserDetailPanel
                tenantSlug={ws.tenantSlug}
                userId={selectedUserId}
                onInvalidateUsers={ws.scheduleAccessUsersListRefresh}
                onGuardChange={setLeaveGuard}
                userAccountControls={
                  ws.selected
                    ? {
                        isActive: ws.selected.status === "active",
                        onToggle: () => void ws.toggleMut.mutateAsync(ws.selected!),
                        onReset: (id) => {
                          if (id !== ws.selected!.id) return;
                          setResetError(null);
                          setResetConfirmOpen(true);
                        },
                        togglePending: ws.toggleMut.isPending && ws.toggleMut.variables?.id === ws.selected!.id,
                        resetPending: ws.resetMut.isPending && ws.resetMut.variables === ws.selected!.id
                      }
                    : null
                }
              />
            </div>
          ) : ws.tab !== "users" && ws.selectedDimension ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden overscroll-y-contain p-3 sm:p-4">
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
          ) : ws.tab === "users" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-card p-8 text-center">
              <UserRoundSearch className="h-12 w-12 text-muted-foreground/60" aria-hidden />
              <p className="max-w-xs text-sm text-muted-foreground">Выберите пользователя слева, чтобы посмотреть и изменить его доступы.</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {`Выберите запись в «${ws.activeTabLabel}» слева.`}
              </p>
            </div>
          )}
        </div>
      </div>
      <AccessWorkspaceUserPickerModal ws={ws} />
      <AccessEntityRoleLinkModal ws={ws} />

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
