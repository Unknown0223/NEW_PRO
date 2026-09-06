"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ClipboardCheck, Search, UserRound } from "lucide-react";
import {
  AgentFormField,
  AgentFormSection,
  agentModalInputClass
} from "@/components/staff/agent-workspace-template-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AssignChecklist, StaffPick, WorkSlotListItem } from "@/lib/work-slots-types";
import { isOperatorLikeSlotType } from "@/lib/work-slots-types";
import { formatSlotDate, staffApiPath } from "./work-slots-utils";
import { SlotBadge } from "./slot-badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  slotId: number | null;
  onAssigned: () => void;
};

const CHECK_ITEMS: { id: string; label: string; testOrderLink?: boolean }[] = [
  { id: "overlap", label: "Kassa/sklad boshqa joy bilan ustma-ust emas" },
  { id: "clients", label: "Mijozlar soni ko‘rib chiqildi" },
  { id: "handoff", label: "Eski xodim chiqariladi, yangisi tasdiqlandi" },
  { id: "verify", label: "Tarix va test zakaz tekshirildi", testOrderLink: true }
];

export function AssignUserDialog({ open, onOpenChange, tenant, slotId, onAssigned }: Props) {
  const [slot, setSlot] = useState<WorkSlotListItem | null>(null);
  const [staff, setStaff] = useState<StaffPick[]>([]);
  const [checklist, setChecklist] = useState<AssignChecklist | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!open || !slotId || !tenant) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await apiFetch<{ data: WorkSlotListItem }>(`/api/${tenant}/work-slots/${slotId}`);
      const s = detail.data;
      setSlot(s);
      const path = staffApiPath(s.slot_type);
      const staffRes = await apiFetch<{
        data: Array<{ id: number; fio: string; code: string | null; kind?: string }>;
      }>(`/api/${tenant}/${path}?limit=500`);
      const rows = staffRes.data ?? [];
      const forSlot = isOperatorLikeSlotType(s.slot_type)
        ? rows.filter((u) => (u.kind ?? "").toLowerCase() === s.slot_type)
        : rows;
      setStaff(
        forSlot.map((u) => ({
          id: u.id,
          fio: u.fio,
          code: u.code,
          kind: u.kind ?? null
        }))
      );
      const cl = await apiFetch<{ data: AssignChecklist }>(`/api/${tenant}/work-slots/${slotId}/checklist`);
      setChecklist(cl.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, [open, slotId, tenant]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
      setNote("");
      setChecks({});
      void load();
    }
  }, [open, load]);

  const filteredStaff = useMemo(() => {
    const tokens = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const list = staff.filter((u) => u.id !== slot?.active_user_id);
    if (!tokens.length) return list;
    return list.filter((u) => {
      const hay = `${u.fio} ${u.code ?? ""}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [staff, search, slot?.active_user_id]);

  const selectedStaff = useMemo(
    () => filteredStaff.find((u) => u.id === selectedId) ?? staff.find((u) => u.id === selectedId),
    [filteredStaff, staff, selectedId]
  );

  const allChecked = CHECK_ITEMS.every((item) => checks[item.id]);
  const checkedCount = CHECK_ITEMS.filter((item) => checks[item.id]).length;

  const submit = async () => {
    if (!slotId || !selectedId) {
      setError("Xodim tanlang");
      return;
    }
    if (!allChecked) {
      setError("Tekshiruv ro‘yxatini belgilang");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/${tenant}/work-slots/${slotId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedId, note: note.trim() || null })
      });
      onOpenChange(false);
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Almashtirib bo‘lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <ArrowRightLeft className="h-4 w-4" />
            </span>
            Xodim almashtirish
            {slot ? <SlotBadge code={slot.slot_code} /> : null}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Joy sozlamalari o‘zgarishsiz qoladi — faqat xodim almashtiriladi.
          </p>
        </DialogHeader>

        {loading ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Hozirgi
                </p>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-card text-slate-500 ring-1 ring-slate-200">
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {slot?.active_user_name ?? "Bo‘sh"}
                    </p>
                    {slot?.active_since ? (
                      <p className="text-[11px] text-muted-foreground">
                        {formatSlotDate(slot.active_since)} dan
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="hidden items-center justify-center sm:flex">
                <ArrowRightLeft className="h-4 w-4 text-teal-600" />
              </div>
              <div
                className={cn(
                  "rounded-xl border p-3",
                  selectedStaff
                    ? "border-teal-200 bg-teal-50/70"
                    : "border-dashed border-slate-200 bg-card"
                )}
              >
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Yangi
                </p>
                <p className="truncate text-sm font-medium text-slate-800">
                  {selectedStaff?.fio ?? "Tanlanmagan"}
                </p>
                {selectedStaff?.code ? (
                  <p className="font-mono text-[11px] text-muted-foreground">{selectedStaff.code}</p>
                ) : null}
              </div>
            </div>

            <AgentFormSection title="Yangi xodim" icon={<Search className="h-4 w-4" />}>
              <AgentFormField label="Qidiruv">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="F.I.O yoki kod..."
                    className={cn(agentModalInputClass, "pl-9")}
                    autoComplete="off"
                  />
                </div>
              </AgentFormField>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-border bg-card">
                {filteredStaff.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">Natija yo‘q</p>
                ) : (
                  filteredStaff.map((u) => {
                    const active = selectedId === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 border-b border-border/70 px-3 py-2.5 text-left text-sm last:border-0 transition",
                          active ? "bg-teal-50" : "hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedId(u.id)}
                      >
                        <span
                          className={cn(
                            "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                            active ? "border-teal-600 bg-teal-600" : "border-slate-300"
                          )}
                          aria-hidden
                        >
                          {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                          {u.fio}
                        </span>
                        {u.code ? (
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {u.code}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </AgentFormSection>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sabab (ixtiyoriy)</Label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Transfer, ta’til, almashtirish…"
                className={agentModalInputClass}
              />
            </div>

            {checklist ? (
              <AgentFormSection title="Tekshiruv" icon={<ClipboardCheck className="h-4 w-4" />}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-card px-3 py-2 text-xs">
                  <span className="text-slate-600">
                    ~{checklist.clients_affected_estimate} mijoz
                    {checklist.locked_clients_skipped > 0
                      ? ` (${checklist.locked_clients_skipped} qulflangan tashqari)`
                      : ""}
                  </span>
                  <span className="font-medium text-teal-700">
                    {checkedCount}/{CHECK_ITEMS.length}
                  </span>
                </div>
                {checklist.cash_desk_conflicts.length > 0 ? (
                  <p className="mb-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">
                    Kassa: {checklist.cash_desk_conflicts.map((c) => c.cash_desk_name).join(", ")}
                  </p>
                ) : null}
                <ul className="space-y-1.5">
                  {CHECK_ITEMS.map((item) => {
                    const on = Boolean(checks[item.id]);
                    return (
                      <li key={item.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition",
                            on
                              ? "border-teal-200 bg-teal-50/80"
                              : "border-transparent hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500/30"
                            checked={on}
                            onChange={(e) =>
                              setChecks((prev) => ({ ...prev, [item.id]: e.target.checked }))
                            }
                          />
                          <span className="min-w-0 flex-1 leading-snug text-slate-700">
                            {item.label}
                            {item.testOrderLink ? (
                              <Link
                                href="/orders/new"
                                className="ml-1.5 text-teal-700 underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Test zakaz
                              </Link>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </AgentFormSection>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/30 px-6 py-3 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor
          </Button>
          <Button
            type="button"
            className="bg-teal-700 hover:bg-teal-800"
            disabled={saving || loading || !selectedId || !allChecked}
            onClick={() => void submit()}
          >
            {saving ? "..." : "Almashtirish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
