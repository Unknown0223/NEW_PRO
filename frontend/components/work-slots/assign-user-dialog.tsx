"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import type { AssignChecklist, StaffPick, WorkSlotListItem } from "@/lib/work-slots-types";
import { formatSlotDate, staffApiPath } from "./work-slots-utils";
import { SlotBadge } from "./slot-badge";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  slotId: number | null;
  onAssigned: () => void;
};

const CHECK_LABELS = [
  "Kassa/sklad boshqa joy bilan ustma-ust emas",
  "Mijozlar soni ko‘rib chiqildi",
  "Eski xodim chiqariladi, yangisi tasdiqlandi",
  "Tarix va test zakaz tekshirildi"
];

export function AssignUserDialog({ open, onOpenChange, tenant, slotId, onAssigned }: Props) {
  const [slot, setSlot] = useState<WorkSlotListItem | null>(null);
  const [staff, setStaff] = useState<StaffPick[]>([]);
  const [checklist, setChecklist] = useState<AssignChecklist | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [checks, setChecks] = useState([false, false, false, false]);
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
      const staffRes = await apiFetch<{ data: Array<{ id: number; fio: string; code: string | null }> }>(
        `/api/${tenant}/${path}?limit=500`
      );
      setStaff(
        (staffRes.data ?? []).map((u) => ({
          id: u.id,
          fio: u.fio,
          code: u.code
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
      setChecks([false, false, false, false]);
      void load();
    }
  }, [open, load]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = staff.filter((u) => u.id !== slot?.active_user_id);
    if (!q) return list;
    return list.filter(
      (u) =>
        u.fio.toLowerCase().includes(q) || (u.code?.toLowerCase().includes(q) ?? false)
    );
  }, [staff, search, slot?.active_user_id]);

  const allChecked = checks.every(Boolean);

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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Xodim almashtirish {slot ? <SlotBadge code={slot.slot_code} /> : null}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium text-muted-foreground">Hozirgi xodim</p>
              <p className="mt-1">
                {slot?.active_user_name ?? "Bo‘sh"}
                {slot?.active_since ? (
                  <span className="text-muted-foreground"> ({formatSlotDate(slot.active_since)} dan)</span>
                ) : null}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Yangi xodim *</Label>
              <Input
                placeholder="Qidirish (F.I.O yoki kod)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto rounded-md border">
                {filteredStaff.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">Natija yo‘q</p>
                ) : (
                  filteredStaff.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60 ${
                        selectedId === u.id ? "bg-primary/10" : ""
                      }`}
                      onClick={() => setSelectedId(u.id)}
                    >
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full border ${
                          selectedId === u.id ? "border-primary bg-primary" : ""
                        }`}
                      />
                      <span>{u.fio}</span>
                      {u.code ? <span className="font-mono text-xs text-muted-foreground">{u.code}</span> : null}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Sabab (ixtiyoriy)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transfer, ta’til..." />
            </div>

            {checklist ? (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">Tekshiruv</p>
                <p className="text-xs text-muted-foreground">
                  Taxminan {checklist.clients_affected_estimate} ta mijoz (
                  {checklist.locked_clients_skipped} qulflangan tashqari)
                </p>
                {checklist.cash_desk_conflicts.length > 0 ? (
                  <p className="text-xs text-destructive">
                    Kassa: {checklist.cash_desk_conflicts.map((c) => c.cash_desk_name).join(", ")}
                  </p>
                ) : null}
                {CHECK_LABELS.map((label, i) => (
                  <label key={label} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border"
                      checked={checks[i]}
                      onChange={(e) => {
                        const next = [...checks];
                        next[i] = e.target.checked;
                        setChecks(next);
                      }}
                    />
                    <span className="flex-1">
                      {label}
                      {i === 3 && tenant ? (
                        <Link
                          href={`/orders/new`}
                          className="ml-2 text-primary underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Test zakaz
                        </Link>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Bekor
          </Button>
          <Button type="button" disabled={saving || loading} onClick={() => void submit()}>
            {saving ? "..." : "Almashtirish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
