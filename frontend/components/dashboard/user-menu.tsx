"use client";

import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Globe, LogOut, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type MeUser = {
  id: number;
  name: string;
  login: string;
  role: string;
  tenantSlug?: string | null;
  tenantName?: string | null;
  code?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  operator: "Оператор",
  supervisor: "Супервайзер",
  director: "Директор",
  sales_director: "Директор по продажам",
  manager: "Менеджер",
  regional_manager: "Региональный менеджер",
  accountant: "Бухгалтер",
  agent: "Агент",
  expeditor: "Экспедитор",
  collector: "Инкассатор",
  skladchik: "Складчик",
  warehouse: "Складчик",
  auditor: "Аудитор"
};

function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

function initials(name: string, login: string): string {
  const src = (name || login || "").trim();
  if (!src) return "—";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const qc = useQueryClient();
  const { tenantSlug, clearSession } = useAuthStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const meQ = useQuery({
    queryKey: ["me", "profile-card", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ user: MeUser }>("/auth/me");
      return data.user;
    }
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const me = meQ.data;
  const displayName = me?.name?.trim() || me?.login || "Пользователь";

  async function logout() {
    const rt = useAuthStore.getState().refreshToken;
    if (rt) {
      try {
        await api.post("/auth/logout", { refreshToken: rt });
      } catch {
        /* sessiyani baribir lokal tozalaymiz */
      }
    }
    clearSession();
    router.replace("/login");
    router.refresh();
  }

  function clearCache() {
    qc.clear();
    setOpen(false);
    window.location.reload();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full p-0.5 outline-none ring-offset-2 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm ring-2 ring-background">
          {initials(me?.name ?? "", me?.login ?? "")}
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials(me?.name ?? "", me?.login ?? "")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel(me?.role)}</p>
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <User className="size-4 text-muted-foreground" aria-hidden />
              Профиль
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={clearCache}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Trash2 className="size-4 text-muted-foreground" aria-hidden />
              Очистить кеш
            </button>

            {/* Til almashtirish — hozircha faqat ko‘rinish (i18n keyinroq) */}
            <div
              className="flex cursor-default items-center justify-between gap-2.5 px-4 py-2.5 text-sm text-muted-foreground"
              title="Скоро"
              aria-disabled
            >
              <span className="flex items-center gap-2.5">
                <Globe className="size-4" aria-hidden />
                Русский
              </span>
              <span className="rounded bg-amber-300/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                скоро
              </span>
            </div>
          </div>

          <div className="border-t border-border/70 py-1">
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-4" aria-hidden />
              Выйти
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
