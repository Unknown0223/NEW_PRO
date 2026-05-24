"use client";

import { FileText, Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fieldClass } from "../../constants";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { PolkiFloatingField } from "./polki-floating-field";
import { polkiCard, polkiFieldLabel } from "./polki-return-ui";

const COMMENT_MAX = 4000;

export function ReturnCommentFields({ vm }: { vm: OrderCreateVm }) {
  const {
    mutation,
    refusalReasonPolkiOptions,
    refusalReasonRefPolki,
    setRefusalReasonRefPolki,
    orderNoteOptions,
    refSelectKey,
    orderNotePreset,
    setOrderNotePreset,
    orderComment,
    setOrderComment
  } = vm;

  return (
    <div className={cn(polkiCard, "p-5")}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600">
          <FileText className="h-4 w-4" aria-hidden />
        </div>
        <h2 className="text-[15px] font-semibold text-slate-800">Комментарий к возврату</h2>
        <span className="ml-auto text-[11px] text-slate-400">
          {orderComment.length} / {COMMENT_MAX}
        </span>
      </div>

      <div className="space-y-4">
        {refusalReasonPolkiOptions.length > 0 ? (
          <PolkiFloatingField label="Причина отказа" htmlFor="oc-polki-refusal-foot">
            <select
              id="oc-polki-refusal-foot"
              className={cn(fieldClass, "h-[46px] pt-3 text-sm focus-visible:border-[#0a8f7e] focus-visible:ring-[#0a8f7e]/15")}
              value={refusalReasonRefPolki}
              onChange={(e) => setRefusalReasonRefPolki(e.target.value)}
              disabled={mutation.isPending}
            >
              <option value="">—</option>
              {refusalReasonPolkiOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </PolkiFloatingField>
        ) : null}

        {orderNoteOptions.length > 0 ? (
          <PolkiFloatingField label="Примечание к заказу">
            <Select
              key={`on-polki-${refSelectKey}`}
              value={orderNotePreset || undefined}
              onValueChange={(v) => setOrderNotePreset(v === "__none__" ? "" : v)}
            >
              <SelectTrigger id="oc-order-note-polki" className="h-[46px] pt-1 text-sm">
                <SelectValue placeholder="— Выберите шаблон —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {orderNoteOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PolkiFloatingField>
        ) : null}

        <div>
          <Label htmlFor="oc-comment-polki" className={polkiFieldLabel}>
            Текст комментария
          </Label>
          <textarea
            id="oc-comment-polki"
            rows={4}
            className={cn(
              fieldClass,
              "mt-1 min-h-[6rem] w-full resize-y py-2.5 text-sm focus-visible:border-[#0a8f7e] focus-visible:ring-[#0a8f7e]/15"
            )}
            value={orderComment}
            onChange={(e) => setOrderComment(e.target.value.slice(0, COMMENT_MAX))}
            disabled={mutation.isPending}
            placeholder="Укажите причину возврата, особые условия, замечания оператора…"
            maxLength={COMMENT_MAX}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
            Данные передаются ответственному менеджеру
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-500 hover:text-rose-600"
            disabled={!orderComment.trim() || mutation.isPending}
            onClick={() => setOrderComment("")}
          >
            Очистить
          </Button>
        </div>
      </div>
    </div>
  );
}
