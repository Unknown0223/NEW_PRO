import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-transparent bg-slate-900 text-slate-50",
        variant === "secondary" && "border-transparent bg-slate-100 text-slate-900",
        variant === "outline" && "text-slate-950",
        variant === "destructive" && "border-transparent bg-red-50 text-red-700",
        variant === "success" && "border-transparent bg-emerald-50 text-emerald-700",
        variant === "warning" && "border-transparent bg-amber-50 text-amber-700",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
