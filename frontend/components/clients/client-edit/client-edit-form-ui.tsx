"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Caption({ children, variant }: { children: ReactNode; variant?: "write" | "pick" }) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-wide",
        variant === "write" && "text-blue-600 dark:text-blue-400",
        variant === "pick" && "text-emerald-700 dark:text-emerald-400",
        !variant && "text-muted-foreground"
      )}
    >
      {children}
    </p>
  );
}

export function FieldHint({ name, errors }: { name: string; errors: Record<string, string> }) {
  const t = errors[name];
  if (!t) return null;
  return <p className="text-xs text-destructive">{t}</p>;
}

export function agentAssignmentsFieldHint(errors: Record<string, string>): string | undefined {
  for (const [k, v] of Object.entries(errors)) {
    if (k === "agent_assignments" || k.startsWith("agent_assignments.")) return v;
  }
  return undefined;
}

export function SpravochnikAdminLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}
