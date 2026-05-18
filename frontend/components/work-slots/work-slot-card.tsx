"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { WorkSlotListItem } from "@/lib/work-slots-types";
import { formatSlotDate, slotTypeLabel } from "./work-slots-utils";
import { LockStatusBadge, SlotBadge } from "./slot-badge";

type Props = {
  slot: WorkSlotListItem;
  resolveTerritoryLabel?: (raw: string) => string;
  expanded: boolean;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onAssign: () => void;
};

function terrLabel(raw: string | null | undefined, resolve?: (s: string) => string) {
  const t = raw?.trim();
  if (!t) return null;
  return resolve ? resolve(t) : t;
}

export function WorkSlotCard({
  slot,
  resolveTerritoryLabel,
  expanded,
  selected = false,
  onToggleSelect,
  onToggleExpand,
  onEdit,
  onAssign
}: Props) {
  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow hover:shadow-md",
        selected && "ring-2 ring-primary ring-offset-1"
      )}
    >
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {onToggleSelect ? (
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                checked={selected}
                aria-label={`Выбрать ${slot.slot_code}`}
                onChange={(e) => onToggleSelect(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
            <div className="min-w-0 flex-1 space-y-1">
              <Link href={`/work-slots/${slot.id}`} className="group flex items-center gap-2">
                <SlotBadge code={slot.slot_code} />
                {!slot.is_active ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Deaktiv
                  </Badge>
                ) : null}
                {slot.is_active ? (
                  <LockStatusBadge lockType={slot.active_user_name ? "manual" : "none"} />
                ) : null}
              </Link>
              <p className="truncate text-sm font-medium">{slot.label ?? slot.slot_code}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleExpand}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {slot.active_user_name ? (
            <>
              <span className="text-foreground">{slot.active_user_name}</span>
              {slot.active_since ? (
                <span> ({formatSlotDate(slot.active_since)} dan)</span>
              ) : null}
            </>
          ) : (
            <span className="italic">Bo‘sh</span>
          )}
        </p>
        {(slot.active_territory_zone ||
          slot.active_territory_oblast ||
          slot.active_territory_city ||
          slot.active_warehouse_name ||
          slot.active_cash_desk_names) ? (
          <p className="truncate text-xs text-muted-foreground">
            {[
              [
                terrLabel(slot.active_territory_zone, resolveTerritoryLabel),
                terrLabel(slot.active_territory_oblast, resolveTerritoryLabel),
                terrLabel(slot.active_territory_city, resolveTerritoryLabel)
              ]
                .filter(Boolean)
                .join(" / "),
              slot.active_warehouse_name,
              slot.active_cash_desk_names
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {slot.branch_code ? (
            <Badge variant="outline" className="text-[10px]">
              {slot.branch_code}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="text-[10px]">
            {slotTypeLabel(slot.slot_type)}
          </Badge>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className="border-t bg-muted/20 pt-3 text-xs text-muted-foreground">
          <p>Yaratilgan: {formatSlotDate(slot.created_at)}</p>
          <p>O‘zgartirilgan: {formatSlotDate(slot.updated_at)}</p>
          {slot.direction_name ? <p>Yo‘nalish: {slot.direction_name}</p> : null}
          {slot.active_territory_zone ? (
            <p>Зона: {terrLabel(slot.active_territory_zone, resolveTerritoryLabel)}</p>
          ) : null}
          {slot.active_territory_oblast ? (
            <p>Область: {terrLabel(slot.active_territory_oblast, resolveTerritoryLabel)}</p>
          ) : null}
          {slot.active_territory_city ? (
            <p>Город: {terrLabel(slot.active_territory_city, resolveTerritoryLabel)}</p>
          ) : null}
          {slot.active_warehouse_name ? <p>Ombor: {slot.active_warehouse_name}</p> : null}
          {slot.active_cash_desk_names ? <p>Kassa: {slot.active_cash_desk_names}</p> : null}
        </CardContent>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t bg-card/50 px-4 py-2">
        <Link
          href={`/work-slots/${slot.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Подробнее
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Tahrirlash
        </Button>
        <Button type="button" size="sm" onClick={onAssign}>
          Almashtirish
        </Button>
      </div>
    </Card>
  );
}
