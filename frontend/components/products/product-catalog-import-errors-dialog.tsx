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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary?: string | null;
  errors: string[];
};

export function ProductCatalogImportErrorsDialog({
  open,
  onOpenChange,
  title,
  summary,
  errors
}: Props) {
  const visible = errors.slice(0, 40);
  const hidden = errors.length - visible.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {summary ? (
            <DialogDescription className="text-left text-foreground/80">{summary}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="max-h-[min(50vh,20rem)] overflow-y-auto rounded-md border border-rose-200 bg-rose-50/80 p-3 text-xs dark:border-rose-900 dark:bg-rose-950/40">
          <p className="font-medium text-rose-900 dark:text-rose-200">Xatolar ({errors.length})</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-rose-900/90 dark:text-rose-200/90">
            {visible.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
            {hidden > 0 ? <li>… yana {hidden} ta</li> : null}
          </ul>
        </div>
        <DialogFooter>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
