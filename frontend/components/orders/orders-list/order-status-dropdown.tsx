"use client";

import type { OrderListRow } from "@/components/orders/order-detail-view";
import {
  orderListStatusLabel,
  orderListStatusStyle
} from "@/lib/order-list-status-labels";
import {
  isBackwardOrderStatusTransition,
  isReopenCancelledTransition,
  reopenConfirmMessage,
  reopenStatusLabel
} from "@/lib/order-status-transitions";
import {
  buildShelfReturnByOrderHref,
  checkShelfReturnByOrder
} from "@/lib/shelf-return-by-order";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";
import {
  Ban,
  Check,
  CheckCircle2,
  PackageSearch,
  RotateCcw,
  Sparkles,
  Truck,
  Undo2,
  type LucideIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ActionKind = "reopen" | "backward" | "forward" | "special" | "text";

type StatusAction = { kind: ActionKind; label: string; value: string };

function buildStatusActions(
  currentStatus: string,
  nextStatuses: string[],
  orderType: string | null | undefined
): StatusAction[] {
  const actions: StatusAction[] = [];

  for (const s of nextStatuses) {
    if (s === currentStatus) continue;
    if (isReopenCancelledTransition(currentStatus, s)) {
      actions.push({ kind: "reopen", label: reopenStatusLabel(orderType), value: s });
    } else if (isBackwardOrderStatusTransition(currentStatus, s, orderType)) {
      actions.push({
        kind: "backward",
        label: `← ${orderListStatusLabel(s, orderType)}`,
        value: s
      });
    } else {
      actions.push({
        kind: "forward",
        label: orderListStatusLabel(s, orderType),
        value: s
      });
    }
  }

  return actions;
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  new: Sparkles,
  confirmed: CheckCircle2,
  picking: PackageSearch,
  delivering: Truck,
  delivered: Check,
  returned: Undo2,
  cancelled: Ban
};

function StatusIcon({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] ?? Sparkles;
  return <Icon className="size-3 shrink-0" aria-hidden />;
}

export type OrderStatusDropdownProps = {
  tenantSlug: string | null;
  order: OrderListRow;
  effectiveRole: string | null | undefined;
  isPending: boolean;
  statusError?: string;
  onStatusChange: (id: number, status: string) => void;
  onChangeShipDate?: (id: number) => void;
};

export const OrderStatusDropdown = memo(function OrderStatusDropdown({
  tenantSlug,
  order,
  effectiveRole,
  isPending,
  statusError,
  onStatusChange,
  onChangeShipDate
}: OrderStatusDropdownProps) {
  const router = useRouter();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [shelfReturnNotice, setShelfReturnNotice] = useState<string | null>(null);
  const [shelfReturnChecking, setShelfReturnChecking] = useState(false);

  const nextStatuses = useMemo(() => {
    const allowed = order.allowed_next_statuses ?? [];
    return allowed.filter((s) => s !== order.status);
  }, [order.allowed_next_statuses, order.status]);

  const { has } = usePermissions();
  const canInteract = has("orders.zakaz.status") || has("orders.status.status");
  const actions = useMemo(() => {
    const base = buildStatusActions(order.status, nextStatuses, order.order_type);
    const specials: StatusAction[] = [];
    if (order.status === "delivered") {
      specials.push({
        kind: "special",
        label: "Возврат с полки по заказ",
        value: "return_from_shelf"
      });
    }
    if (order.status === "confirmed") {
      specials.push({
        kind: "special",
        label: "Изменить ожидаемую дату отгрузки",
        value: "change_ship_date"
      });
    }
    return [...specials, ...base];
  }, [order.status, order.order_type, nextStatuses]);

  const hasMenu = canInteract && actions.some((a) => a.kind !== "text");
  const style = orderListStatusStyle(order.status, order.order_type);
  const label = orderListStatusLabel(order.status, order.order_type);

  useEffect(() => {
    if (!shelfReturnNotice) return;
    const t = window.setTimeout(() => setShelfReturnNotice(null), 6000);
    return () => window.clearTimeout(t);
  }, [shelfReturnNotice]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      const r = anchorRef.current!.getBoundingClientRect();
      const panelH = panelRef.current?.offsetHeight ?? 220;
      const below = r.bottom + 4;
      const fitsBelow = below + panelH < window.innerHeight - 8;
      setMenuPos({
        top: fitsBelow ? below : Math.max(8, r.top - panelH - 4),
        left: Math.max(8, Math.min(r.left, window.innerWidth - 280))
      });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const startShelfReturnByOrder = async () => {
    if (!tenantSlug?.trim()) {
      setShelfReturnNotice("Сессия не готова. Обновите страницу.");
      return;
    }
    const clientId = order.client_id;
    if (!Number.isFinite(clientId) || clientId < 1) {
      setShelfReturnNotice("У заказа не указан клиент.");
      return;
    }
    setShelfReturnChecking(true);
    setShelfReturnNotice(null);
    try {
      const result = await checkShelfReturnByOrder(tenantSlug, clientId, order.id);
      if (!result.allowed) {
        setShelfReturnNotice(
          result.message?.trim() || "Возврат с полки по этому заказу недоступен."
        );
        return;
      }
      router.push(buildShelfReturnByOrderHref(clientId, order.id));
    } catch (e) {
      setShelfReturnNotice(
        getUserFacingError(e, "Не удалось проверить условия возврата. Попробуйте снова.")
      );
    } finally {
      setShelfReturnChecking(false);
    }
  };

  if (!hasMenu) {
    return (
      <span className="inline-flex flex-col gap-0.5 align-top">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium leading-tight"
          style={{ background: style.bg, color: style.text, borderColor: style.border }}
        >
          <StatusIcon status={order.status} />
          <span className="whitespace-nowrap">{label}</span>
        </span>
        {statusError ? (
          <span className="max-w-[12rem] text-[10px] text-destructive">{statusError}</span>
        ) : null}
      </span>
    );
  }

  const onSpecial = (action: string) => {
    if (action === "return_from_shelf") {
      void startShelfReturnByOrder();
      return;
    }
    if (action === "change_ship_date") {
      onChangeShipDate?.(order.id);
      return;
    }
  };

  const onPickStatus = (action: StatusAction) => {
    if (action.kind === "reopen") {
      if (!window.confirm(reopenConfirmMessage(order.order_type))) return;
    }
    onStatusChange(order.id, action.value);
    setOpen(false);
  };

  const menuPanel = open ? (
    <div
      ref={panelRef}
      role="menu"
      className="fixed z-[200] min-w-[260px] overflow-hidden rounded-lg border border-border bg-card py-1 text-foreground shadow-xl dark:border-border dark:bg-popover dark:text-popover-foreground"
      style={{ top: menuPos.top, left: menuPos.left }}
    >
      {actions.map((action, idx) =>
        action.kind === "special" ? (
          <button
            key={idx}
            type="button"
            role="menuitem"
            disabled={action.value === "return_from_shelf" && shelfReturnChecking}
            className="w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-teal-50 disabled:opacity-60 dark:hover:bg-teal-950/40"
            onClick={() => {
              onSpecial(action.value);
              setOpen(false);
            }}
          >
            {action.value === "return_from_shelf" && shelfReturnChecking
              ? "Проверка…"
              : action.label}
          </button>
        ) : action.kind === "reopen" ? (
          <button
            key={idx}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-teal-800 transition-colors hover:bg-teal-50 dark:text-teal-200 dark:hover:bg-teal-950/40"
            onClick={() => onPickStatus(action)}
          >
            <RotateCcw className="size-4 shrink-0" aria-hidden />
            {action.label}
          </button>
        ) : action.kind === "backward" ? (
          <button
            key={idx}
            type="button"
            role="menuitem"
            className="w-full px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60"
            onClick={() => onPickStatus(action)}
          >
            {action.label}
          </button>
        ) : action.kind === "forward" ? (
          <button
            key={idx}
            type="button"
            role="menuitem"
            className="w-full px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
            onClick={() => onPickStatus(action)}
          >
            {action.label}
          </button>
        ) : (
          <div key={idx} className="cursor-default px-3 py-2.5 text-sm text-muted-foreground">
            {action.label}
          </div>
        )
      )}
    </div>
  ) : null;

  return (
    <span className="inline-flex flex-col gap-0.5 align-top" onClick={(e) => e.stopPropagation()}>
      <button
        ref={anchorRef}
        type="button"
        disabled={isPending}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium leading-tight transition-opacity",
          "cursor-pointer hover:opacity-90",
          isPending && "opacity-60"
        )}
        style={{ background: style.bg, color: style.text, borderColor: style.border }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <StatusIcon status={order.status} />
        <span className="whitespace-nowrap text-left">{label}</span>
      </button>
      {typeof document !== "undefined" && menuPanel ? createPortal(menuPanel, document.body) : null}
      {statusError ? (
        <span className="max-w-[12rem] text-[10px] text-destructive">{statusError}</span>
      ) : null}
      {shelfReturnNotice ? (
        <span
          className="max-w-[14rem] rounded-md border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[10px] leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          {shelfReturnNotice}
        </span>
      ) : null}
    </span>
  );
});
