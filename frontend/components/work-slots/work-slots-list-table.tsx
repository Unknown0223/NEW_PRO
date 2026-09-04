"use client";

import { useRouter } from "next/navigation";
import {
  Eye,
  LayoutGrid,
  MonitorSmartphone,
  Pencil,
  Shield,
  Smartphone,
  Tags,
  Truck,
  UserRound,
  Users,
  Warehouse
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AgentIconButton } from "@/components/staff/agent-workspace-template-ui";
import { StaffFaceAvatar } from "@/components/staff/staff-face-avatar";
import { formatMaxSessionsLabel } from "@/lib/max-sessions";
import type { WorkSlotListItem } from "@/lib/work-slots-types";
import {
  formatSlotDate,
  formatSlotBranches,
  slotTypeLabel,
  slotWorkplaceConfigTabs,
  type SlotWorkplaceConfigTabId,
  type WorkSlotsColumnId
} from "./work-slots-utils";
import { SlotBadge } from "./slot-badge";

function cellTerritory(raw: string | null | undefined, resolve?: (s: string) => string) {
  const t = raw?.trim();
  if (!t) return "—";
  return resolve ? resolve(t) : t;
}

/** Ustun qiymati — Agents/Expeditors jadval uslubida. */
export function renderWorkSlotDataCell(
  slot: WorkSlotListItem,
  colId: string,
  opts: {
    resolveTerritoryLabel?: (raw: string) => string;
    onOpenDetail?: (id: number) => void;
    onOpenSessions?: (slot: WorkSlotListItem) => void;
    tenantSlug?: string;
  } = {}
) {
  const id = colId as WorkSlotsColumnId;
  const resolve = opts.resolveTerritoryLabel;
  switch (id) {
    case "code":
      return (
        <button
          type="button"
          className="text-left hover:opacity-80"
          title="Подробнее"
          onClick={() => opts.onOpenDetail?.(slot.id)}
        >
          <SlotBadge code={slot.slot_code} />
        </button>
      );
    case "label":
      return <span className="block max-w-[12rem] truncate">{slot.label ?? "—"}</span>;
    case "employee":
      return slot.active_user_name && slot.active_user_id ? (
        <div className="flex min-w-0 items-center gap-2.5">
          {opts.tenantSlug ? (
            <StaffFaceAvatar
              tenantSlug={opts.tenantSlug}
              userId={slot.active_user_face_user_id ?? slot.active_user_id}
              initials={slot.active_user_name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0] ?? "")
                .join("")}
              alt={slot.active_user_name}
              size="sm"
              hasPhoto={slot.active_user_has_face_reference === true}
            />
          ) : null}
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-800">{slot.active_user_name}</div>
            {slot.active_since ? (
              <div className="text-[10px] text-muted-foreground">{formatSlotDate(slot.active_since)}</div>
            ) : null}
          </div>
        </div>
      ) : (
        <span className="italic text-muted-foreground">Пусто</span>
      );
    case "territory_zone":
      return cellTerritory(slot.active_territory_zone, resolve);
    case "territory_oblast":
      return cellTerritory(slot.active_territory_oblast, resolve);
    case "territory_city":
      return cellTerritory(slot.active_territory_city, resolve);
    case "warehouse":
      return (
        <span className="block max-w-[10rem] truncate">{slot.active_warehouse_name ?? "—"}</span>
      );
    case "cash_desk":
      return (
        <span className="block max-w-[10rem] truncate">{slot.active_cash_desk_names ?? "—"}</span>
      );
    case "active_sessions": {
      if (!slot.active_user_id) return <span className="text-muted-foreground">—</span>;
      const n = slot.active_user_active_session_count ?? 0;
      return (
        <button
          type="button"
          className="tabular-nums text-teal-700 hover:underline"
          title="Активные сессии"
          onClick={() => opts.onOpenSessions?.(slot)}
        >
          {n}
        </button>
      );
    }
    case "max_sessions": {
      if (!slot.active_user_id) return <span className="text-muted-foreground">—</span>;
      return (
        <button
          type="button"
          className="tabular-nums text-slate-800 hover:underline"
          title="Лимит сессий"
          onClick={() => opts.onOpenSessions?.(slot)}
        >
          {formatMaxSessionsLabel(slot.active_user_max_sessions)}
        </button>
      );
    }
    case "branch":
      return <span className="text-slate-700">{formatSlotBranches(slot)}</span>;
    case "role":
      return <span className="text-slate-600">{slotTypeLabel(slot.slot_type)}</span>;
    case "status":
      return slot.is_active ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">
          Активно
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px]">
          Неактивно
        </Badge>
      );
    default:
      return "—";
  }
}

const SECTION_ICON: Record<
  SlotWorkplaceConfigTabId,
  typeof LayoutGrid
> = {
  main: LayoutGrid,
  prices: Tags,
  limits: Shield,
  mobile: Smartphone,
  expeditor: Truck,
  skladchik: Warehouse,
  team: Users
};

type RowActionsProps = {
  slot: WorkSlotListItem;
  /** Konfiguratsiya bo‘limini ochish (main / prices / limits / mobile / …) */
  onOpenSection: (section: SlotWorkplaceConfigTabId) => void;
  onEdit: () => void;
  onAssign: () => void;
  onOpenSessions?: () => void;
};

/**
 * Har konfiguratsiya bo‘limi — alohida ikon (tabli modal yo‘q).
 */
export function WorkSlotRowActions({ slot, onOpenSection, onEdit, onAssign, onOpenSessions }: RowActionsProps) {
  const router = useRouter();
  const sections = slotWorkplaceConfigTabs(slot.slot_type);

  return (
    <div className="flex items-center justify-end gap-0.5">
      {sections.map((s) => {
        const Icon = SECTION_ICON[s.id] ?? LayoutGrid;
        return (
          <AgentIconButton key={s.id} title={s.label} onClick={() => onOpenSection(s.id)}>
            <Icon
              className={
                s.id === "mobile"
                  ? "h-4 w-4 text-teal-600"
                  : s.id === "limits"
                    ? "h-4 w-4 text-slate-600"
                    : s.id === "prices"
                      ? "h-4 w-4 text-amber-600"
                      : "h-4 w-4"
              }
            />
          </AgentIconButton>
        );
      })}
      {slot.active_user_id && onOpenSessions ? (
        <AgentIconButton title="Активные сессии" onClick={onOpenSessions}>
          <MonitorSmartphone className="h-4 w-4 text-teal-700" />
        </AgentIconButton>
      ) : null}
      <AgentIconButton
        title="Подробнее / история"
        onClick={() => router.push(`/work-slots/${slot.id}`)}
      >
        <Eye className="h-4 w-4" />
      </AgentIconButton>
      <AgentIconButton title="Редактировать" onClick={onEdit}>
        <Pencil className="h-4 w-4 text-amber-600" />
      </AgentIconButton>
      <AgentIconButton title="Сменить сотрудника" onClick={onAssign}>
        <UserRound className="h-4 w-4" />
      </AgentIconButton>
    </div>
  );
}
