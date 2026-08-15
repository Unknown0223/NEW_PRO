"use client";

import { AccessUserDetailModals } from "./access-user-detail-modals";
import { AccessUserDetailOperationsTab } from "./access-user-detail-operations-tab";
import { AccessUserDetailToolbar } from "./access-user-detail-toolbar";
import { useAccessUserDetailPanel } from "./hooks/use-access-user-detail-panel";
import type { AccessUserAccountControls } from "./access-user-detail.types";

export function AccessUserDetailPanel({
  tenantSlug,
  userId,
  onInvalidateUsers,
  userAccountControls
}: {
  tenantSlug: string;
  userId: number;
  onInvalidateUsers: () => void;
  userAccountControls?: AccessUserAccountControls | null;
}) {
  const vm = useAccessUserDetailPanel({ tenantSlug, userId, onInvalidateUsers, userAccountControls });

  if (vm.detailQ.isError && !vm.user) {
    return <p className="px-4 pt-16 text-sm text-destructive">Не удалось загрузить данные доступа</p>;
  }

  /**
   * Modal holati hook da — body yuklanayotganda ham Dialog mount qolishi kerak.
   * Aks holda detail refetch / qisqa `!user` Dialog ni yechib `onOpenChange(false)` chaqiradi.
   */
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {!vm.user ? (
        <p className="px-4 pt-16 text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <>
          <AccessUserDetailToolbar vm={vm} />
          <div className="min-h-0 flex-1 p-3 flex flex-col overflow-hidden overscroll-contain">
            <AccessUserDetailOperationsTab vm={vm} />
          </div>
        </>
      )}
      <AccessUserDetailModals vm={vm} />
    </div>
  );
}
