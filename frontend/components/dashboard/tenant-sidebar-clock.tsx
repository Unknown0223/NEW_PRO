"use client";

import { useAuthStore, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { getAppTimezone, setAppTimezone } from "@/lib/app-timezone";
import { formatUtcOffsetLabel } from "@/lib/iana-timezones";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

function offsetMinutesInTz(timeZone: string, instant: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(instant);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = tzName.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/i);
    if (m) {
      const sign = m[1] === "-" ? -1 : 1;
      const h = Number(m[2]);
      const mins = m[3] != null ? Number(m[3]) : 0;
      if (Number.isFinite(h) && Number.isFinite(mins)) return sign * (h * 60 + mins);
    }
  } catch {
    /* ignore */
  }
  return 5 * 60;
}

function formatParts(instant: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  let hour = map.hour ?? "00";
  if (hour === "24") hour = "00";
  return {
    time: `${hour}:${map.minute ?? "00"}:${map.second ?? "00"}`,
    offsetLabel: formatUtcOffsetLabel(offsetMinutesInTz(timeZone, instant))
  };
}

type Props = {
  className?: string;
  /** Compact: faqat soat (sidebar o‘ng tomoni). */
  compact?: boolean;
  /** Sidebar (dark) yoki yuqori header (light). */
  tone?: "sidebar" | "header";
};

/**
 * Tenant ish mintaqasidagi joriy vaqt — logo ostidagi slug yonida.
 * Sozlamalar → Vaqt mintaqasi bilan bir xil IANA.
 */
export function TenantSidebarClock({ className, compact = true, tone = "sidebar" }: Props) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useEffectiveRole();
  const isAdmin = role === "admin";

  const { data: timezone } = useQuery({
    queryKey: ["settings", "profile", "timezone-clock", tenantSlug],
    enabled: Boolean(tenantSlug && accessToken),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data: body } = await api.get<{ timezone?: string }>(
        `/api/${tenantSlug}/settings/profile`
      );
      const tz = body.timezone?.trim() || getAppTimezone();
      setAppTimezone(tz);
      return tz;
    }
  });

  const tz = timezone || getAppTimezone();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // SSR/hydration: vaqt faqat clientda — aks holda sekund farqi hydration error beradi.
  const { time, offsetLabel } = now
    ? formatParts(now, tz)
    : { time: "--:--:--", offsetLabel: "" };
  const title = now ? `Время компании · ${tz} · ${offsetLabel}` : "Время компании";

  const body = (
    <span
      className={cn(
        "tabular-nums tracking-tight",
        compact ? "text-[11px] font-semibold" : "text-xs font-medium",
        tone === "sidebar" ? "text-sidebar-foreground/85" : "text-muted-foreground",
        className
      )}
      title={title}
      suppressHydrationWarning
    >
      {time}
      {!compact && offsetLabel ? (
        <span className="ml-1.5 font-normal opacity-70">{offsetLabel}</span>
      ) : null}
    </span>
  );

  if (isAdmin) {
    return (
      <Link
        href="/settings/timezone"
        className={cn(
          "shrink-0 rounded px-1 py-0.5",
          tone === "sidebar"
            ? "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            : "hover:bg-muted hover:text-foreground"
        )}
        title={`${title} — настроить`}
        aria-label="Настроить часовой пояс"
      >
        {body}
      </Link>
    );
  }

  return <span className="shrink-0">{body}</span>;
}
