"use client";

import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/dashboard/page-shell";
import { apiBaseURL, resolveApiOrigin } from "@/lib/api";
import { getUserFacingError, isApiUnreachable } from "@/lib/error-utils";
import type { OrderCreateVm } from "../../hooks/use-order-create";
import { CompositionBlock } from "./composition-block";
import { PolkiInfoBanner } from "./info-banner";
import { ReturnHeaderBlock } from "./return-header-block";
import { ReturnParamsGrid } from "./return-params-grid";
import { ReturnSelectedOrderSummary } from "./return-selected-order-summary";

export function PolkiShelfReturnView({ vm }: { vm: OrderCreateVm }) {
  const {
    createCtxQ,
    localError,
    selectionNotice,
    canSubmit,
    polkiSubmitBlockedReason
  } = vm;

  const submitTitle = !canSubmit
    ? (polkiSubmitBlockedReason ?? "Заполните обязательные поля")
    : undefined;

  return (
    <PageShell className="max-w-none space-y-4 pb-8">
      {localError ? (
        <p className="text-sm text-destructive" role="alert">
          {localError}
        </p>
      ) : null}
      {selectionNotice ? (
        <p className="text-sm text-amber-700" role="status">
          {selectionNotice}
        </p>
      ) : null}

      {createCtxQ.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          <p className="font-semibold text-destructive">Нет связи с API</p>
          <p className="mt-1 text-muted-foreground">
            {isApiUnreachable(createCtxQ.error) ? (
              <>
                Адрес:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  {apiBaseURL || resolveApiOrigin()}
                </code>
              </>
            ) : (
              getUserFacingError(createCtxQ.error, "Не удалось загрузить данные формы.")
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void createCtxQ.refetch()}
          >
            Повторить
          </Button>
        </div>
      ) : null}

      <PolkiInfoBanner vm={vm} />

      <div className="space-y-4">
        <ReturnHeaderBlock vm={vm} />
        <ReturnParamsGrid vm={vm} />
        <ReturnSelectedOrderSummary vm={vm} />
        <CompositionBlock vm={vm} submitTitle={submitTitle} />
      </div>

      <p className="text-xs text-slate-500">
        После проведения — приход на склад возврата. Бонус по правилам; недостающий бонус — долг на баланс
        клиента («Балансы»). Количество по строке — не больше «макс. всего» из доставленных продаж.
      </p>

    </PageShell>
  );
}
