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

export type ClientImportDecisionPreviewDto = {
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  errorSamples: string[];
  totalErrorMessages: number;
  rowIssues: Array<{
    excelRow: number;
    kind: "error" | "duplicate";
    message: string;
    fields: string[];
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string;
  errors: string[];
  needsDecision?: boolean;
  decisionPreview?: ClientImportDecisionPreviewDto | null;
  busy?: boolean;
  onAcceptValid?: () => void;
  onRejectAll?: () => void;
  onOpenReview?: () => void;
};

function isPerfLine(line: string): boolean {
  return line.includes("Import stats:");
}

/** Import yakunida: xato bo‘lsa tanlov (faqat to‘g‘ri / bekor) + qisqa xato ro‘yxati. */
export function ClientImportResultDialog({
  open,
  onOpenChange,
  summary,
  errors,
  needsDecision = false,
  decisionPreview = null,
  busy = false,
  onAcceptValid,
  onRejectAll,
  onOpenReview
}: Props) {
  const useful = errors.filter((e) => !isPerfLine(e));
  const samples =
    decisionPreview?.errorSamples?.length
      ? decisionPreview.errorSamples
      : useful.filter((e) => /Qator\s+\d+/i.test(e)).slice(0, 5);
  const totalErr =
    decisionPreview?.totalErrorMessages ??
    useful.filter((e) => /Qator\s+\d+/i.test(e)).length;
  const hidden = Math.max(0, totalErr - samples.length);
  const validCount = decisionPreview?.validCount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{needsDecision ? "Import — tanlov kerak" : "Import natijasi"}</DialogTitle>
          <DialogDescription className="text-left text-foreground/90">{summary}</DialogDescription>
        </DialogHeader>

        {needsDecision ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Faylda xato bor. Hech narsa yozilmagan.{" "}
              <b>{validCount}</b> ta to‘g‘ri qatorni qabul qilish yoki hammasini bekor qilish
              mumkin. Dublikatlar hech qachon qabul qilinmaydi.
            </p>
            {samples.length > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50/80 p-3 text-xs dark:border-red-900 dark:bg-red-950/40">
                <p className="font-medium text-red-950 dark:text-red-100">
                  Xatolar ({totalErr})
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-red-950/90 dark:text-red-100/90">
                  {samples.map((line, i) => (
                    <li key={`${i}-${line.slice(0, 40)}`}>{line}</li>
                  ))}
                </ul>
                {hidden > 0 ? (
                  <button
                    type="button"
                    className="mt-2 font-semibold text-red-700 underline underline-offset-2 hover:text-red-900 dark:text-red-300"
                    onClick={() => onOpenReview?.()}
                  >
                    +{hidden}…
                  </button>
                ) : onOpenReview ? (
                  <button
                    type="button"
                    className="mt-2 text-[11px] font-medium text-red-700 underline underline-offset-2 dark:text-red-300"
                    onClick={() => onOpenReview()}
                  >
                    Batafsil jadval
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : useful.length > 0 ? (
          <div className="max-h-[min(42vh,16rem)] overflow-y-auto rounded-md border border-amber-200 bg-amber-50/80 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40">
            <p className="font-medium text-amber-950 dark:text-amber-100">
              Xabarlar ({useful.length})
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-amber-950/90 dark:text-amber-100/90">
              {useful.slice(0, 24).map((line, i) => (
                <li key={`${i}-${line.slice(0, 28)}`}>{line}</li>
              ))}
              {useful.length > 24 ? <li>… yana {useful.length - 24} ta</li> : null}
            </ul>
            {decisionPreview && onOpenReview ? (
              <button
                type="button"
                className="mt-2 text-[11px] font-medium text-amber-900 underline dark:text-amber-200"
                onClick={() => onOpenReview()}
              >
                Batafsil jadval
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Qator bo‘yicha qo‘shimcha xato yo‘q.</p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          {needsDecision ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onRejectAll?.()}
              >
                Hammasini bekor
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || validCount <= 0}
                onClick={() => onAcceptValid?.()}
              >
                Faqat to‘g‘rilarni qabul ({validCount})
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
              Yopish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
