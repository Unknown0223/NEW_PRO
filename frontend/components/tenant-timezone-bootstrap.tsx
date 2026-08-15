"use client";

import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { setAppTimezone } from "@/lib/app-timezone";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

/** Dashboard ochilganda tenant timezone ni display formatlarga yuklaydi. */
export function TenantTimezoneBootstrap() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data } = useQuery({
    queryKey: ["settings", "profile", "timezone-bootstrap", tenantSlug],
    enabled: Boolean(tenantSlug && accessToken),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data: body } = await api.get<{ timezone?: string }>(
        `/api/${tenantSlug}/settings/profile`
      );
      return body.timezone ?? null;
    }
  });

  useEffect(() => {
    if (data) setAppTimezone(data);
  }, [data]);

  return null;
}
