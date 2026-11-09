"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { isExcludedFromAccessWebUsersList, isWebPanelDeniedRole } from "@/lib/access-web-users";
import { cn } from "@/lib/utils";
import { AccessRoleDefaultsByOperation } from "./access-role-defaults-by-operation";
import { AccessRoleDefaultsByRole } from "./access-role-defaults-by-role";

type RoleDefaultRow = {
  id: number;
  key: string;
  name: string;
  operations_count: number;
  permissions: string[];
};

export function AccessRoleDefaultsWorkspace({
  tenantSlug,
  className
}: {
  tenantSlug: string;
  className?: string;
}) {
  const [bindMode, setBindMode] = useState<"role" | "operation">("role");

  const rolesQ = useQuery({
    queryKey: ["access-role-defaults", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await api.get<{ data: RoleDefaultRow[] }>(
        `/api/${tenantSlug}/access/role-defaults`
      );
      return data.data;
    }
  });

  const webRoles = useMemo(
    () => (rolesQ.data ?? []).filter((r) => !isExcludedFromAccessWebUsersList(r.key) && !isWebPanelDeniedRole(r.key)),
    [rolesQ.data]
  );

  return (
    <div
      className={cn(
        "access-surface flex min-h-0 flex-1 flex-col gap-3 p-3",
        className
      )}
    >
      <div className="flex shrink-0 gap-1 rounded-lg bg-muted/60 p-1" role="group" aria-label="Способ привязки">
        {(
          [
            ["role", "По роли"],
            ["operation", "По операции"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={bindMode === id}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium",
              bindMode === id ? "bg-teal-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setBindMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">
        {bindMode === "role"
          ? "Отметьте роли слева и операции справа, затем «Прикрепить» или «Открепить». Одна роль — сразу виден её текущий состав."
          : "Отметьте операции слева и роли справа, затем «Прикрепить» или «Открепить». Переключатель — можно ли выдавать доступ другим."}
      </p>
      {bindMode === "operation" ? (
        <AccessRoleDefaultsByOperation tenantSlug={tenantSlug} roles={webRoles} rolesLoading={rolesQ.isLoading} />
      ) : (
        <AccessRoleDefaultsByRole tenantSlug={tenantSlug} roles={webRoles} rolesLoading={rolesQ.isLoading} />
      )}
    </div>
  );
}
