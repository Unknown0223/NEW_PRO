"use client";

import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Modal sarlavhasidagi harakatlar: yuklash va boshqalar + yopish (X).
 * DialogContent da `showCloseButton={false}` qo‘ying — standart X ustma-ust tushmaydi.
 */
export function DialogHeaderActions({
  children,
  className
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-3", className)}>
      {children}
      <DialogClose
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-lg"
            aria-label="Закрыть"
          />
        }
      >
        <XIcon className="size-4" aria-hidden />
        <span className="sr-only">Закрыть</span>
      </DialogClose>
    </div>
  );
}
