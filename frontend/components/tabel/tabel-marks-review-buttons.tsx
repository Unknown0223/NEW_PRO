"use client";

import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markNeedsReview, type TabelMarkRow } from "@/components/tabel/tabel-marks-types";
import { getUserFacingError } from "@/lib/error-utils";

export function TabelMarksReviewButtons({
  row,
  onlyProblems,
  pending,
  onReview
}: {
  row: TabelMarkRow;
  onlyProblems: boolean;
  pending: boolean;
  onReview: (id: number, decision: "approved" | "rejected") => Promise<void>;
}) {
  if (!(onlyProblems || markNeedsReview(row))) return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-[11px] text-emerald-700"
        disabled={pending}
        onClick={() =>
          void onReview(row.id, "approved").catch((e) => {
            window.alert(getUserFacingError(e, "Ошибка"));
          })
        }
      >
        Одобрить
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-[11px] text-rose-700"
        disabled={pending}
        onClick={() =>
          void onReview(row.id, "rejected").catch((e) => {
            window.alert(getUserFacingError(e, "Ошибка"));
          })
        }
      >
        <XCircle className="mr-1 size-3" />
        Отклонить
      </Button>
    </>
  );
}
