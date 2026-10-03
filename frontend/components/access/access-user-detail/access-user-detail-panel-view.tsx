"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageError } from "@/components/ui/page-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { LEAVE_UNSAVED_MESSAGE } from "@/components/access/permission-tree/access-save-bar";
import { AccessUserDetailModals } from "./access-user-detail-modals";
import { AccessUserDetailHeader, type AccessUserDetailTab } from "./access-user-detail-header";
import { AccessUserOperationsEditor } from "./access-user-operations-editor";
import { AccessUserDelegationTab } from "./access-user-delegation-tab";
import { AccessUserHistoryTab } from "./access-user-history-tab";
import { AccessUserScopeSummary, isAccessScopeTab } from "./access-user-scope-summary";
import { useAccessUserDetailPanel } from "./hooks/use-access-user-detail-panel";
import type { AccessUserAccountControls } from "./access-user-detail.types";

export type AccessLeaveGuard = (action: () => void) => void;

export function AccessUserDetailPanel({
  tenantSlug,
  userId,
  onInvalidateUsers,
  userAccountControls,
  onBack,
  onGuardChange
}: {
  tenantSlug: string;
  userId: number;
  onInvalidateUsers: () => void;
  userAccountControls?: AccessUserAccountControls | null;
  onBack?: () => void;
  /** Ota komponentga «saqlanmagan o'zgarishlar» tekshiruvini beradi (boshqa tab / foydalanuvchiga o'tishda). */
  onGuardChange?: (guard: AccessLeaveGuard | null) => void;
}) {
  const vm = useAccessUserDetailPanel({ tenantSlug, userId, onInvalidateUsers, userAccountControls });
  const [tab, setTab] = useState<AccessUserDetailTab>("operations");
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const { confirm, dialog } = useAppConfirm();

  const guard = useCallback<AccessLeaveGuard>(
    (action) => {
      if (!dirtyRef.current) {
        action();
        return;
      }
      void confirm({
        title: "Несохраненные изменения",
        message: LEAVE_UNSAVED_MESSAGE,
        confirmLabel: "Покинуть",
        cancelLabel: "Остаться"
      }).then((ok) => {
        if (!ok) return;
        setDirty(false);
        action();
      });
    },
    [confirm]
  );

  useEffect(() => {
    onGuardChange?.(guard);
    return () => onGuardChange?.(null);
  }, [guard, onGuardChange]);

  useEffect(() => {
    setTab("operations");
    setDirty(false);
  }, [userId]);

  if (vm.detailQ.isError && !vm.user) {
    return (
      <div className="p-4">
        <PageError message="Не удалось загрузить данные доступа пользователя." onRetry={() => void vm.detailQ.refetch()} />
      </div>
    );
  }

  const readOnly = vm.detailQ.data?.actor ? !vm.detailQ.data.actor.can_edit_user : false;

  /** Modal holati hook da — body yuklanayotganda ham Dialog mount qolishi kerak. */
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {!vm.user ? (
        <div className="space-y-3 p-4" aria-busy="true" aria-label="Загрузка пользователя">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <AccessUserDetailHeader
            vm={vm}
            tab={tab}
            onTab={(t) => guard(() => setTab(t))}
            onBack={onBack ? () => guard(onBack) : undefined}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-y-contain p-3">
            {tab === "operations" ? <AccessUserOperationsEditor key={userId} vm={vm} onDirtyChange={setDirty} /> : null}
            {tab === "delegation" ? <AccessUserDelegationTab key={userId} vm={vm} onDirtyChange={setDirty} /> : null}
            {tab === "history" ? <AccessUserHistoryTab tenantSlug={tenantSlug} userId={userId} /> : null}
            {isAccessScopeTab(tab) ? <AccessUserScopeSummary vm={vm} tab={tab} readOnly={readOnly} /> : null}
          </div>
        </>
      )}
      <AccessUserDetailModals vm={vm} />
      {dialog}
    </div>
  );
}
