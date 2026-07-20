"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch, useTenantReady } from "@/lib/api-client";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { SlotHistoryItem, WorkSlotListItem } from "@/lib/work-slots-types";
import { AssignUserDialog } from "./assign-user-dialog";
import { EditSlotDialog } from "./edit-slot-dialog";
import { SlotWorkplaceConfigDialog } from "./slot-workplace-config-dialog";
import { formatSlotDate, slotTypeLabel } from "./work-slots-utils";
import { SlotBadge } from "./slot-badge";

export function WorkSlotDetail({ slotId }: { slotId: number }) {
  const { tenant, ready, hydrated } = useTenantReady();
  const [slot, setSlot] = useState<WorkSlotListItem | null>(null);
  const [history, setHistory] = useState<SlotHistoryItem[]>([]);
  const [debtCollectors, setDebtCollectors] = useState<
    Array<{
      user_id: number;
      name: string;
      is_active: boolean;
      on_active_slot: boolean;
      unpaid: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [cashDesks, setCashDesks] = useState<{ id: number; name: string }[]>([]);
  const [clientRefs, setClientRefs] = useState<{
    zones?: string[];
    regions?: string[];
    cities?: string[];
    region_options?: { value: string; label: string }[];
    city_options?: { value: string; label: string }[];
    city_territory_hints?: Record<string, { city_label?: string | null }>;
  }>({});
  const [territoryNodes, setTerritoryNodes] = useState<TerritoryNode[]>([]);
  const [tradeDirections, setTradeDirections] = useState<
    Array<{ id: number; name: string; code: string | null }>
  >([]);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [detail, hist, debtCol, list, whTable, cash, refs, profile, tradeDirs] = await Promise.all([
        apiFetch<{ data: WorkSlotListItem }>(`/api/${tenant}/work-slots/${slotId}`),
        apiFetch<{ data: SlotHistoryItem[] }>(`/api/${tenant}/work-slots/${slotId}/history?limit=30`),
        apiFetch<{
          data: Array<{
            user_id: number;
            name: string;
            is_active: boolean;
            on_active_slot: boolean;
            unpaid: string;
          }>;
        }>(`/api/${tenant}/work-slots/${slotId}/debt-collectors`).catch(() => ({ data: [] })),
        apiFetch<{ data: WorkSlotListItem[] }>(`/api/${tenant}/work-slots?limit=100`),
        apiFetch<{ data: { id: number; name: string }[] }>(
          `/api/${tenant}/warehouses/table?is_active=true&page=1&limit=200`
        ),
        apiFetch<{ data: { id: number; name: string }[] }>(
          `/api/${tenant}/cash-desks?is_active=true&limit=200&page=1`
        ),
        apiFetch<{
          zones?: string[];
          regions?: string[];
          cities?: string[];
          region_options?: { value: string; label: string }[];
          city_options?: { value: string; label: string }[];
          city_territory_hints?: Record<string, { city_label?: string | null }>;
        }>(`/api/${tenant}/clients/references`),
        apiFetch<{ references?: { territory_nodes?: TerritoryNode[] } }>(
          `/api/${tenant}/settings/profile`
        ).catch(() => ({ references: undefined })),
        apiFetch<{ data: Array<{ id: number; name: string; code: string | null }> }>(
          `/api/${tenant}/trade-directions?is_active=true`
        ).catch(() => ({ data: [] }))
      ]);
      setWarehouses((whTable.data ?? []).map((w) => ({ id: w.id, name: w.name })));
      setCashDesks((cash.data ?? []).map((c) => ({ id: c.id, name: c.name })));
      setClientRefs(refs);
      setTerritoryNodes(profile.references?.territory_nodes ?? []);
      setTradeDirections(tradeDirs.data ?? []);
      setSlot(detail.data);
      setHistory(hist.data ?? []);
      setDebtCollectors(debtCol.data ?? []);
      const branches = new Set<string>();
      for (const r of list.data ?? []) {
        if (r.branch_code?.trim()) branches.add(r.branch_code.trim());
      }
      setBranchOptions([...branches].sort());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tenant, slotId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const unassign = async () => {
    if (!tenant || !confirm("Hozirgi xodimni ajratishni tasdiqlaysizmi?")) return;
    try {
      await apiFetch(`/api/${tenant}/work-slots/${slotId}/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ajratib bo‘lmadi");
    }
  };

  if (!hydrated || (loading && !slot)) {
    return <p className="text-muted-foreground">Yuklanmoqda...</p>;
  }
  if (!tenant) {
    return <p className="text-destructive">Tenant aniqlanmadi. Qayta kiring.</p>;
  }
  if (!slot) {
    return <p className="text-destructive">Slot topilmadi</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/work-slots" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← К списку
          </Link>
          <SlotBadge code={slot.slot_code} />
          <h1 className="text-2xl font-bold">{slot.label ?? slot.slot_code}</h1>
          {!slot.is_active ? <Badge variant="secondary">Deaktiv</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Tahrirlash
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            Конфигурация места
          </Button>
          <Button type="button" size="sm" onClick={() => setAssignOpen(true)}>
            Almashtirish
          </Button>
          {slot.active_user_id ? (
            <Button type="button" variant="destructive" size="sm" onClick={() => void unassign()}>
              Olib tashlash
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Slot ma’lumotlari</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Kodi:</span> {slot.slot_code}
          </p>
          <p>
            <span className="text-muted-foreground">Nomi:</span> {slot.label ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Filial:</span> {slot.branch_code ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Направление:</span> {slot.direction_name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Склад:</span> {slot.active_warehouse_name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Склад возврата:</span>{" "}
            {slot.return_warehouse_name ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Тип цены:</span> {slot.price_type ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Консигнация:</span> {slot.consignment ? "Да" : "Нет"}
          </p>
          <p>
            <span className="text-muted-foreground">Tur:</span> {slotTypeLabel(slot.slot_type)}
          </p>
          <p>
            <span className="text-muted-foreground">Holat:</span> {slot.is_active ? "✅ Aktiv" : "Deaktiv"}
          </p>
          <p>
            <span className="text-muted-foreground">Yaratilgan:</span> {formatSlotDate(slot.created_at)}
          </p>
          <p>
            <span className="text-muted-foreground">O‘zgartirilgan:</span> {formatSlotDate(slot.updated_at)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hozirgi mas’ul</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Xodim:</span>{" "}
            {slot.active_user_name ?? <span className="italic text-muted-foreground">Bo‘sh</span>}
          </p>
          {slot.active_since ? (
            <p>
              <span className="text-muted-foreground">Biriktirish:</span> {formatSlotDate(slot.active_since)}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Mijoz qulflashi — mijoz kartasida (slot 1). Zakazlar shartnoma qulfiga bo‘ysunadi.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Qarz yig‘ishdagi agentlar (shu slot)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Slotda ishlagan agentlar: hali to‘lanmagan yetkazilgan buyurtma qarzi. Nom bilan ko‘rsatiladi (mijoz
            boshqa agentga o‘tgan bo‘lsa ham).
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Агент</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Слот</TableHead>
                <TableHead className="text-right">Долг по заказам</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debtCollectors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Qarzli sobiq/hozirgi agent yo‘q
                  </TableCell>
                </TableRow>
              ) : (
                debtCollectors.map((d) => (
                  <TableRow key={d.user_id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>
                      {d.is_active ? (
                        <Badge variant="secondary">Активен</Badge>
                      ) : (
                        <Badge variant="outline">Архив</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.on_active_slot ? "Faol slotda" : "Slotsiz"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {Number(d.unpaid).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Almashtirish tarixi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sana</TableHead>
                <TableHead>Harakat</TableHead>
                <TableHead>Eski</TableHead>
                <TableHead>Yangi</TableHead>
                <TableHead>Kim</TableHead>
                <TableHead>Sabab</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Tarix yo‘q
                  </TableCell>
                </TableRow>
              ) : (
                history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatSlotDate(h.created_at)}
                    </TableCell>
                    <TableCell>{h.action}</TableCell>
                    <TableCell>{h.prev_user_name ?? "—"}</TableCell>
                    <TableCell>{h.next_user_name ?? "—"}</TableCell>
                    <TableCell>{h.actor_name ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{h.note ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditSlotDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenant={tenant}
        slotId={slotId}
        branchOptions={branchOptions}
        tradeDirections={tradeDirections}
        warehouses={warehouses}
        cashDesks={cashDesks}
        clientRefs={clientRefs}
        territoryNodes={territoryNodes}
        onSaved={() => void load()}
      />
      <SlotWorkplaceConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        tenant={tenant}
        slotId={slotId}
        warehouses={warehouses}
        onSaved={() => void load()}
      />
      <AssignUserDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        tenant={tenant}
        slotId={slotId}
        onAssigned={() => void load()}
      />
    </div>
  );
}
