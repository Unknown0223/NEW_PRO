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
import { Input } from "@/components/ui/input";
import { useAuthStore, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { DEFAULT_APP_TIMEZONE, setAppTimezone } from "@/lib/app-timezone";
import { getUserFacingError } from "@/lib/error-utils";
import {
  detectDeviceTimezone,
  formatUtcOffsetLabel,
  listDeviceIanaTimezones,
  type IanaTimezoneOption
} from "@/lib/iana-timezones";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TenantProfileTimezone = {
  timezone: string;
  utc_offset_hours?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TimezoneSettingsDialog({ open, onOpenChange }: Props) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  const [timezone, setTimezone] = useState(DEFAULT_APP_TIMEZONE);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const zones = useMemo(() => listDeviceIanaTimezones(), []);
  const deviceTz = useMemo(() => detectDeviceTimezone(), []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["settings", "profile", "timezone", tenantSlug],
    enabled: Boolean(tenantSlug && open),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data: body } = await api.get<TenantProfileTimezone>(
        `/api/${tenantSlug}/settings/profile`
      );
      return {
        timezone: body.timezone?.trim() || DEFAULT_APP_TIMEZONE,
        utc_offset_hours: body.utc_offset_hours
      };
    }
  });

  useEffect(() => {
    if (!open || !data) return;
    setTimezone(data.timezone);
    setAppTimezone(data.timezone);
    setQuery("");
    setMsg(null);
  }, [open, data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => z.search.includes(q) || z.id.toLowerCase().includes(q));
  }, [zones, query]);

  const selectedMeta: IanaTimezoneOption | undefined = useMemo(
    () => zones.find((z) => z.id === timezone),
    [zones, timezone]
  );

  const dirty = data != null && timezone !== data.timezone;

  const saveMut = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/${tenantSlug}/settings/profile`, { timezone });
    },
    onSuccess: async () => {
      setAppTimezone(timezone);
      setMsg("Saqlandi");
      await qc.invalidateQueries({ queryKey: ["settings", "profile"] });
      onOpenChange(false);
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,640px)] w-[min(96vw,28rem)] max-w-[28rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[28rem]"
        overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[2px]"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-teal-700" aria-hidden />
            Vaqt mintaqasi
          </DialogTitle>
          <DialogDescription className="text-xs leading-snug">
            Qurilmalardagi standart IANA ro‘yxati. Sync oynasi va sanalar shu mintaqa bo‘yicha.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">{getUserFacingError(error)}</p>
          ) : (
            <>
              <div className="relative shrink-0">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Qidirish: Tashkent, Moscow, UTC+5…"
                  className="h-9 pl-9"
                  disabled={!isAdmin || saveMut.isPending}
                  autoFocus
                />
              </div>

              {deviceTz ? (
                <button
                  type="button"
                  disabled={!isAdmin || saveMut.isPending}
                  onClick={() => {
                    setTimezone(deviceTz);
                    setMsg(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                    timezone === deviceTz
                      ? "border-teal-600/50 bg-teal-50 text-teal-950"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="font-medium text-foreground">Qurilma mintaqasi</span>
                  <span className="mt-0.5 block truncate">{deviceTz}</span>
                </button>
              ) : null}

              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border border-border"
                role="listbox"
                aria-label="Vaqt mintaqalari"
              >
                {filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Topilmadi
                  </p>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {filtered.map((z) => {
                      const active = z.id === timezone;
                      return (
                        <li key={z.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            disabled={!isAdmin || saveMut.isPending}
                            onClick={() => {
                              setTimezone(z.id);
                              setMsg(null);
                            }}
                            className={cn(
                              "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                              active
                                ? "bg-primary/10 text-foreground"
                                : "hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                              (!isAdmin || saveMut.isPending) && "opacity-60"
                            )}
                          >
                            <span className="mt-0.5 w-4 shrink-0">
                              {active ? (
                                <Check className="size-4 text-teal-700" aria-hidden />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium leading-snug text-foreground">
                                {z.label}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                {z.id}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <p className="shrink-0 text-[11px] text-muted-foreground">
                Tanlangan:{" "}
                <span className="font-medium text-foreground">{timezone}</span>
                {selectedMeta
                  ? ` · ${formatUtcOffsetLabel(selectedMeta.offsetMinutes)}`
                  : null}
              </p>

              {!isAdmin ? (
                <p className="text-xs text-muted-foreground">Faqat admin o‘zgartira oladi.</p>
              ) : null}
              {msg ? (
                <p
                  className={
                    saveMut.isError ? "text-sm text-destructive" : "text-sm text-teal-800"
                  }
                >
                  {msg}
                </p>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/30 px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={saveMut.isPending}
            onClick={() => onOpenChange(false)}
          >
            Yopish
          </Button>
          {isAdmin ? (
            <div className="flex gap-2">
              {dirty ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saveMut.isPending}
                  onClick={() => {
                    setTimezone(data?.timezone ?? DEFAULT_APP_TIMEZONE);
                    setMsg(null);
                  }}
                >
                  Bekor
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={!dirty || saveMut.isPending || isLoading}
                onClick={() => saveMut.mutate()}
              >
                {saveMut.isPending ? "Saqlanmoqda…" : "Saqlash"}
              </Button>
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
