"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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
import { WorkSlotsMultiSelect } from "./work-slots-multi-select";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { WorkSlotType } from "@/lib/work-slots-types";
import { SLOT_ACTIVE_STATUS_ITEMS, SLOT_TYPE_OPTIONS } from "./work-slots-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  branchOptions: string[];
  onCreated: () => void;
};

export function CreateSlotDialog({ open, onOpenChange, tenant, branchOptions, onCreated }: Props) {
  const [slotCode, setSlotCode] = useState("");
  const [label, setLabel] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [slotType, setSlotType] = useState<WorkSlotType>("agent");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestedCode = useCallback(async () => {
    if (!tenant) return;
    setCodeLoading(true);
    try {
      const p = new URLSearchParams({ slot_type: slotType });
      if (branchCode.trim()) p.set("branch_code", branchCode.trim());
      const res = await apiFetch<{ data: { slot_code: string } }>(
        `/api/${tenant}/work-slots/suggest-code?${p.toString()}`
      );
      setSlotCode(res.data.slot_code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сгенерировать код");
    } finally {
      setCodeLoading(false);
    }
  }, [tenant, slotType, branchCode]);

  const reset = () => {
    setSlotCode("");
    setLabel("");
    setBranchCode("");
    setSlotType("agent");
    setIsActive(true);
    setError(null);
  };

  useEffect(() => {
    if (!open || !tenant) return;
    void fetchSuggestedCode();
  }, [open, tenant, fetchSuggestedCode]);

  const validate = (): string | null => {
    const code = slotCode.trim();
    if (!code) return "Smart-код обязателен";
    if (!/^[A-Za-z0-9-]{1,32}$/.test(code)) return "Код: буквы, цифры или дефис (1–32)";
    if (!slotType) return "Выберите роль";
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/${tenant}/work-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_code: slotCode.trim(),
          label: label.trim() || null,
          branch_code: branchCode.trim() || null,
          slot_type: slotType,
          is_active: isActive
        })
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новое рабочее место</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1">
            <Label>Smart-код *</Label>
            <div className="flex gap-2">
              <Input
                value={slotCode}
                onChange={(e) => setSlotCode(e.target.value.toUpperCase())}
                placeholder="A-SERGEli-001"
                className="font-mono"
                readOnly={codeLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Сгенерировать код"
                disabled={codeLoading}
                onClick={() => void fetchSuggestedCode()}
              >
                <RefreshCw className={cn("size-4", codeLoading && "animate-spin")} aria-hidden />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Код создаётся автоматически (роль / филиал)</p>
          </div>
          <div className="space-y-1">
            <Label>Название</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Север — розница" />
          </div>
          <div className="space-y-1">
            <Label>Филиал</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Филиал"
              items={[
                { id: "__none__", title: "—" },
                ...branchOptions.map((b) => ({ id: b, title: b }))
              ]}
              selectedValues={branchCode ? [branchCode] : []}
              onChange={(next) => {
                const v = next[0] ?? "";
                setBranchCode(v === "__none__" ? "" : v);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Роль *</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Роль"
              items={SLOT_TYPE_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
              selectedValues={[slotType]}
              onChange={(next) => {
                const v = next[0];
                if (v) setSlotType(v as WorkSlotType);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Статус места</Label>
            <WorkSlotsMultiSelect
              variant="form"
              multiple={false}
              placeholder="Статус"
              items={SLOT_ACTIVE_STATUS_ITEMS}
              selectedValues={[isActive ? "true" : "false"]}
              onChange={(next) => setIsActive((next[0] ?? "true") === "true")}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={saving || codeLoading || !slotCode.trim()} onClick={() => void submit()}>
            {saving ? "…" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
