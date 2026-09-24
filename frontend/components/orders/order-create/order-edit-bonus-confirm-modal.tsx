"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Gift } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildGiftLinesFromQtyMap,
  clampGiftQty,
  giftsForBonusConfirmModal,
  initialGiftQtyMap,
  initialStrategySelections,
  maxBonusQtyForRule,
  toggleStrategyRule,
  type BonusGiftLinePayload,
  type BonusStrategySelectionPayload,
  type OrderBonusPreviewResponse
} from "./order-edit-bonus-confirm.logic";

export type OrderEditBonusConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  error: string | null;
  preview: OrderBonusPreviewResponse | null;
  saving: boolean;
  onConfirm: (payload: {
    bonus_gift_lines: BonusGiftLinePayload[];
    bonus_strategy_selections: BonusStrategySelectionPayload[];
  }) => void;
};

export function OrderEditBonusConfirmModal({
  open,
  onOpenChange,
  loading,
  error,
  preview,
  saving,
  onConfirm
}: OrderEditBonusConfirmModalProps) {
  const bonuses = preview?.eligible_bonuses ?? [];
  const strategies = preview?.strategies ?? [];

  const [qtyMap, setQtyMap] = useState<Record<string, Record<string, string>>>({});
  const [strategySel, setStrategySel] = useState<BonusStrategySelectionPayload[]>([]);

  useEffect(() => {
    if (!open || !preview) return;
    setQtyMap(initialGiftQtyMap(bonuses, preview.auto_apply?.bonus_gifts));
    setStrategySel(initialStrategySelections(strategies));
    // faqat preview ochilganda / yangilanganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preview]);

  const ruleNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const b of bonuses) m.set(b.rule_id, b.name);
    return m;
  }, [bonuses]);

  const totalSelected = useMemo(() => {
    let n = 0;
    for (const byPid of Object.values(qtyMap)) {
      for (const raw of Object.values(byPid)) {
        const q = Number.parseFloat(String(raw).replace(",", "."));
        if (Number.isFinite(q) && q > 0) n += Math.floor(q);
      }
    }
    return n;
  }, [qtyMap]);

  const setGiftQty = (ruleId: number, productId: number, raw: string, max: number) => {
    const key = String(ruleId);
    const pidKey = String(productId);
    setQtyMap((prev) => {
      const byPid = { ...(prev[key] ?? {}) };
      const others = Object.entries(byPid)
        .filter(([k]) => k !== pidKey)
        .reduce((s, [, v]) => s + clampGiftQty(v, max), 0);
      const room = Math.max(0, max - others);
      if (raw.trim() === "") {
        byPid[pidKey] = "";
      } else {
        const q = clampGiftQty(raw, room);
        byPid[pidKey] = q > 0 ? String(q) : "";
      }
      return { ...prev, [key]: byPid };
    });
  };

  const handleConfirm = () => {
    onConfirm({
      bonus_gift_lines: buildGiftLinesFromQtyMap(bonuses, qtyMap),
      bonus_strategy_selections: strategySel
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!saving ? onOpenChange(v) : undefined)}>
      <DialogContent
        className="z-[500] max-h-[85vh] overflow-y-auto sm:max-w-lg"
        overlayClassName="z-[500] bg-black/40"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-5 text-teal-700" aria-hidden />
            Bonusni tasdiqlash
          </DialogTitle>
          <DialogDescription>
            Saqlashdan oldin bonus miqdorini tekshiring. Yuqorida qoida nomi va maksimal
            berilish — pastda faqat qiymat kiriting (± yo‘q).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Bonus hisoblanmoqda…</p>
        ) : error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : bonuses.length === 0 && strategies.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Bu zakaz uchun qo‘llanadigan bonus topilmadi. Saqlashni davom ettirish mumkin.
          </p>
        ) : (
          <div className="space-y-4 py-1">
            {strategies.some((s) => s.requires_choice || s.eligible_rule_ids.length > 1) ? (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Strategiya
                </p>
                {strategies.map((s) => {
                  const selected =
                    strategySel.find((x) => x.strategy_id === s.strategy_id)?.rule_ids ?? [];
                  return (
                    <div
                      key={s.strategy_id}
                      className="rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                    >
                      <div className="mb-2 text-sm font-medium text-foreground">
                        {s.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          (max {s.max_select})
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {s.eligible_rule_ids.map((rid) => {
                          const checked = selected.includes(rid);
                          return (
                            <label
                              key={rid}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="size-4 rounded border-border"
                                checked={checked}
                                disabled={saving}
                                onChange={() =>
                                  setStrategySel((prev) => toggleStrategyRule(prev, s, rid))
                                }
                              />
                              <span>{ruleNameById.get(rid) ?? `Qoida #${rid}`}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {bonuses.map((rule) => {
              const max = maxBonusQtyForRule(rule);
              const gifts = giftsForBonusConfirmModal(rule, preview?.auto_apply?.bonus_gifts);
              return (
                <div
                  key={rule.rule_id}
                  className="rounded-lg border border-teal-200/80 bg-teal-50/40 px-3 py-3 dark:border-teal-900 dark:bg-teal-950/20"
                >
                  <div className="mb-2">
                    <div className="text-sm font-semibold text-foreground">{rule.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Maksimal berilish:{" "}
                      <span className="font-medium tabular-nums text-teal-800 dark:text-teal-300">
                        {max}
                      </span>
                    </div>
                  </div>
                  {gifts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Avtomatik hisoblanadi (assortiment / server).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {gifts.map((g) => {
                        const raw = qtyMap[String(rule.rule_id)]?.[String(g.product_id)] ?? "";
                        return (
                          <div key={g.product_id} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{g.name}</Label>
                            <Input
                              type="number"
                              min={0}
                              max={max}
                              inputMode="numeric"
                              disabled={saving || max <= 0}
                              className="h-9 tabular-nums"
                              value={raw}
                              onChange={(e) =>
                                setGiftQty(rule.rule_id, g.product_id, e.target.value, max)
                              }
                              onBlur={(e) =>
                                setGiftQty(rule.rule_id, g.product_id, e.target.value, max)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            <p className={cn("text-xs text-muted-foreground")}>
              Jami tanlangan bonus:{" "}
              <span className="font-medium tabular-nums text-foreground">{totalSelected}</span>
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Bekor
          </Button>
          <Button
            type="button"
            disabled={loading || Boolean(error) || saving}
            className="bg-teal-600 text-white hover:bg-teal-700"
            onClick={handleConfirm}
          >
            {saving ? "Saqlanmoqda…" : "Tasdiqlash va saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
