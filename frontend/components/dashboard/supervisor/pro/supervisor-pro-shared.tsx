"use client";

import type { ReactNode } from "react";

export function SupervisorProPanel({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
