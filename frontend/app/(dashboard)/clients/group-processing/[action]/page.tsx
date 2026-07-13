"use client";

import { GroupProcessingAttrsWorkspace } from "@/components/clients/group-processing/group-processing-attrs-workspace";
import { GroupProcessingDebtWorkspace } from "@/components/clients/group-processing/group-processing-debt-workspace";
import { GroupProcessingMiscWorkspace } from "@/components/clients/group-processing/group-processing-misc-workspace";
import { GroupProcessingOpsWorkspace } from "@/components/clients/group-processing/group-processing-ops-workspace";
import { GroupProcessingTeamWorkspace } from "@/components/clients/group-processing/group-processing-team-workspace";
import { GroupProcessingTerritoryWorkspace } from "@/components/clients/group-processing/group-processing-territory-workspace";
import {
  GROUP_PROCESSING_ACTIONS,
  GROUP_PROCESSING_ATTRS_ALIASES,
  GROUP_PROCESSING_DEBT_ALIASES,
  GROUP_PROCESSING_IDS_STORAGE_KEY,
  GROUP_PROCESSING_MISC_ALIASES,
  GROUP_PROCESSING_OPS_ALIASES,
  type GroupProcessingActionId
} from "@/components/clients/group-processing/group-processing-actions";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const VALID = new Set(GROUP_PROCESSING_ACTIONS.map((a) => a.id));

function parseIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[, ]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ].slice(0, 5000);
}

function loadStoredIds(): number[] {
  try {
    const raw = sessionStorage.getItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 5000);
  } catch {
    return [];
  }
}

/** «Показать на карте» — stub o‘rniga to‘g‘ridan-to‘g‘ri /clients/map. */
function MapRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const fromQ = parseIds(searchParams.get("ids"));
    const ids = fromQ.length ? fromQ : loadStoredIds();
    if (ids.length === 0) {
      router.replace("/clients/map");
      return;
    }
    try {
      sessionStorage.setItem(GROUP_PROCESSING_IDS_STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
    const qs = ids.length <= 200 ? `?ids=${ids.join(",")}` : "?from=group";
    router.replace(`/clients/map${qs}`);
  }, [router, searchParams]);

  return <p className="p-4 text-sm text-muted-foreground">Открываем карту…</p>;
}

function ActionBody({ action }: { action: string }) {
  if (!VALID.has(action as GroupProcessingActionId)) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-destructive">Неизвестный раздел: {action}</p>
        <Link href="/clients" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Назад · клиенты
        </Link>
      </div>
    );
  }

  if (action === "team") {
    return <GroupProcessingTeamWorkspace />;
  }

  if (GROUP_PROCESSING_ATTRS_ALIASES.has(action as GroupProcessingActionId)) {
    return <GroupProcessingAttrsWorkspace />;
  }

  if (action === "territory") {
    return <GroupProcessingTerritoryWorkspace />;
  }

  if (GROUP_PROCESSING_OPS_ALIASES.has(action as GroupProcessingActionId)) {
    return <GroupProcessingOpsWorkspace />;
  }

  if (GROUP_PROCESSING_DEBT_ALIASES.has(action as GroupProcessingActionId)) {
    return <GroupProcessingDebtWorkspace />;
  }

  if (GROUP_PROCESSING_MISC_ALIASES.has(action as GroupProcessingActionId)) {
    return <GroupProcessingMiscWorkspace />;
  }

  if (action === "map") {
    return <MapRedirect />;
  }

  const def = GROUP_PROCESSING_ACTIONS.find((a) => a.id === action);
  return (
    <div className="space-y-3 p-6">
      <h1 className="text-lg font-semibold">{def?.label ?? action}</h1>
      <p className="text-sm text-muted-foreground">Этот раздел пока не подключён.</p>
      <Link href="/clients" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Назад · клиенты
      </Link>
    </div>
  );
}

export default function GroupProcessingActionPage() {
  const params = useParams();
  const raw = params.action;
  const action = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="relative min-h-0 w-full flex-1">
      <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Загрузка…</p>}>
        <ActionBody action={action ?? ""} />
      </Suspense>
    </div>
  );
}
