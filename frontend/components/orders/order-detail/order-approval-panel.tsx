"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export type OrderApprovalView = {
  approval_status: string | null;
  approval_step: number;
  approval_chain: { user_id: number; name: string; role: string; kind: string }[];
  current_approver: { user_id: number; name: string; role: string; kind: string } | null;
  can_advance: boolean;
};

export function OrderApprovalPanel({
  tenantSlug,
  orderId,
  orderStatus,
  approvalStatus
}: {
  tenantSlug: string;
  orderId: number;
  orderStatus: string;
  approvalStatus?: string | null;
}) {
  const qc = useQueryClient();
  const pending =
    approvalStatus === "pending" ||
    approvalStatus === "rejected" ||
    orderStatus === "new";
  const enabled = Boolean(tenantSlug) && orderId > 0 && pending;

  const approvalQ = useQuery({
    queryKey: ["order-approval", tenantSlug, orderId],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<{ data: OrderApprovalView }>(
        `/api/${tenantSlug}/orders/${orderId}/approval`
      );
      return data.data;
    }
  });

  const advanceMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { approval: OrderApprovalView; order?: unknown } }>(
        `/api/${tenantSlug}/orders/${orderId}/approval/advance`,
        {}
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-approval", tenantSlug, orderId] });
      void qc.invalidateQueries({ queryKey: ["order", tenantSlug, orderId] });
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
    }
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: OrderApprovalView }>(
        `/api/${tenantSlug}/orders/${orderId}/approval/reject`,
        {}
      );
      return data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order-approval", tenantSlug, orderId] });
    }
  });

  const view = approvalQ.data;
  if (!enabled || approvalQ.isLoading) return null;
  if (!view?.approval_status) return null;

  return (
    <section className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
      <p className="font-medium">Tasdiqlash zanjiri</p>
      <p className="mt-1 text-muted-foreground">
        Holat: <strong>{view.approval_status}</strong>
        {view.current_approver ? (
          <>
            {" "}
            · Joriy: <strong>{view.current_approver.name}</strong> ({view.approval_step + 1}/
            {view.approval_chain.length})
          </>
        ) : null}
      </p>
      {view.can_advance ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" disabled={advanceMut.isPending} onClick={() => advanceMut.mutate()}>
            {advanceMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tasdiqlash"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={rejectMut.isPending}
            onClick={() => rejectMut.mutate()}
          >
            Rad etish
          </Button>
        </div>
      ) : null}
    </section>
  );
}
