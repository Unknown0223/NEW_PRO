"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore } from "@/lib/auth-store";

export type WorkdaysEmployee = { id: number; fio: string; role: string; login: string };

type FiltersDto = {
  roles: string[];
  employees: WorkdaysEmployee[];
};

/**
 * Сотрудники и роли для модуля «Рабочие дни».
 * Переиспользуем существующий эндпоинт Табеля `/api/:slug/timesheet/filters`,
 * чтобы индивидуальные графики строились на реальных сотрудниках.
 */
export function useWorkdaysData() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  const filtersQ = useQuery({
    queryKey: ["timesheet-filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FiltersDto }>(`/api/${tenantSlug}/timesheet/filters`);
      return data.data;
    }
  });

  return {
    tenantSlug,
    roles: filtersQ.data?.roles ?? [],
    employees: filtersQ.data?.employees ?? [],
    isLoading: filtersQ.isLoading,
    isError: filtersQ.isError
  };
}
