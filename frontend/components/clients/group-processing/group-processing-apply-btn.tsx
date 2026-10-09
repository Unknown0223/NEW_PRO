"use client";

import { Button } from "@/components/ui/button";

type Props = {
  onClick: () => void;
  /** Chapdagi umumiy qator — barcha ustunlar */
  all?: boolean;
};

export function GpMasterApplyButton({ onClick, all = false }: Props) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={all ? "h-7 text-[11px]" : "mt-1 h-6 w-full max-w-[11rem] text-[10px]"}
      onClick={onClick}
    >
      {all ? "Применить все" : "Применить"}
    </Button>
  );
}
