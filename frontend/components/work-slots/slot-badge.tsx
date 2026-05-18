import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SlotBadge({
  code,
  className
}: {
  code: string | null | undefined;
  className?: string;
}) {
  if (!code?.trim()) return null;
  return (
    <Badge variant="outline" className={cn("font-mono text-xs", className)}>
      {code.trim()}
    </Badge>
  );
}

export function LockStatusBadge({ lockType }: { lockType: string }) {
  if (lockType === "contract") {
    return <Badge variant="destructive">Qulflangan</Badge>;
  }
  if (lockType === "manual") {
    return <Badge variant="secondary">Qo‘lda</Badge>;
  }
  return <Badge variant="outline">Erkin</Badge>;
}
