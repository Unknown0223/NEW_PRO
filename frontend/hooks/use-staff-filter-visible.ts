"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type FilterVisibleSegment =
  | "agents"
  | "supervisors"
  | "expeditors"
  | "collectors"
  | "auditors"
  | "skladchik"
  | "operators";

export function useStaffFilterVisible(opts: {
  tenantSlug: string;
  segment: FilterVisibleSegment;
  invalidateQueryKeys: unknown[][];
}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: number[]; filter_visible: boolean }) => {
      const ids = [...new Set(args.ids.filter((id) => id > 0))];
      if (ids.length === 0) return;
      if (ids.length === 1) {
        await api.patch(`/api/${opts.tenantSlug}/${opts.segment}/${ids[0]}`, {
          filter_visible: args.filter_visible
        });
        return;
      }
      if (opts.segment === "agents") {
        await api.post(`/api/${opts.tenantSlug}/agents/bulk`, {
          action: "set_filter_visible",
          agent_ids: ids,
          filter_visible: args.filter_visible
        });
        return;
      }
      if (opts.segment === "operators") {
        await api.post(`/api/${opts.tenantSlug}/operators/filter-visible`, {
          user_ids: ids,
          filter_visible: args.filter_visible
        });
        return;
      }
      await api.post(`/api/${opts.tenantSlug}/${opts.segment}/bulk`, {
        action: "set_filter_visible",
        user_ids: ids,
        filter_visible: args.filter_visible
      });
    },
    onSuccess: () => {
      for (const queryKey of opts.invalidateQueryKeys) {
        void qc.invalidateQueries({ queryKey });
      }
      void qc.invalidateQueries({ queryKey: ["access-users-supervisor-pick", opts.tenantSlug] });
    }
  });
}
