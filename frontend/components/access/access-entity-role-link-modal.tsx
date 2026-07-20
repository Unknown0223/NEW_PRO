"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import {
  emptySetsForRoles,
  linksFromRoleSets,
  setsFromRoleLinks
} from "@/components/role-link-picker/role-link-picker-grid";
import {
  ENTITY_LINK_ROLE_COLUMNS,
  ENTITY_LINK_ROLE_KEYS,
  RoleLinkUsersModal
} from "@/components/role-link-picker/role-link-users-modal";
import type { UseAccessWorkspaceReturn } from "@/components/access/use-access-workspace";

type PickerUser = { id: number; name: string; login: string };
type PickersData = {
  agents: PickerUser[];
  operators: PickerUser[];
  supervisors: PickerUser[];
  expeditors: PickerUser[];
};
type EntityLink = { link_role: string; user: PickerUser };

/**
 * Access → Кассы / Склады «Пользователи» — same attach picker as Доступ → Сотрудники
 * (and Касса/Склад settings forms). Saves entity `links` (preserves link_role).
 */
export function AccessEntityRoleLinkModal({ ws }: { ws: UseAccessWorkspaceReturn }) {
  const qc = useQueryClient();
  const kind = ws.usersModalKind;
  const open =
    ws.opUsersModalOpen && (kind === "cash_desks" || kind === "warehouses") && Boolean(ws.selectedDimension);
  const entityId = open ? Number(ws.selectedDimension!.key) : NaN;
  const validId = Number.isInteger(entityId) && entityId > 0;

  const [draft, setDraft] = useState(() => emptySetsForRoles(ENTITY_LINK_ROLE_KEYS));
  const [search, setSearch] = useState("");

  const pickersPath =
    kind === "cash_desks"
      ? `/api/${ws.tenantSlug}/cash-desks/pickers`
      : `/api/${ws.tenantSlug}/warehouses/pickers`;
  const detailPath =
    kind === "cash_desks"
      ? `/api/${ws.tenantSlug}/cash-desks/${entityId}`
      : `/api/${ws.tenantSlug}/warehouses/${entityId}`;

  const pickersQ = useQuery({
    queryKey: ["access-entity-role-pickers", ws.tenantSlug, kind],
    enabled: open && validId,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: PickersData }>(pickersPath);
      return data.data;
    }
  });

  const detailQ = useQuery({
    queryKey: ["access-entity-role-detail", ws.tenantSlug, kind, entityId],
    enabled: open && validId,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<{ data: { links: EntityLink[] } }>(detailPath);
      return data.data;
    }
  });

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    if (!detailQ.data) {
      setDraft(emptySetsForRoles(ENTITY_LINK_ROLE_KEYS));
      return;
    }
    setDraft(
      setsFromRoleLinks(
        ENTITY_LINK_ROLE_KEYS,
        detailQ.data.links.map((l) => ({ link_role: l.link_role, user_id: l.user.id }))
      )
    );
  }, [open, detailQ.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const links = linksFromRoleSets(ENTITY_LINK_ROLE_KEYS, draft);
      await api.patch(detailPath, { links });
    },
    onSuccess: async () => {
      ws.setOpUsersModalOpen(false);
      const dimBase = ["access-dimension-users", ws.tenantSlug, kind] as const;
      if (ws.selectedKey) {
        await qc.refetchQueries({ queryKey: [...dimBase, ws.selectedKey], type: "active" });
      } else {
        await qc.refetchQueries({ queryKey: [...dimBase], type: "active" });
      }
      void qc.invalidateQueries({ queryKey: ["access-dimensions", ws.tenantSlug, kind] });
      void qc.invalidateQueries({ queryKey: ["access-entity-role-detail", ws.tenantSlug, kind, entityId] });
      void qc.invalidateQueries({ queryKey: ["cash-desks", ws.tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["warehouses-table", ws.tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["warehouses", ws.tenantSlug] });
    }
  });

  const close = () => {
    if (saveMut.isPending) return;
    ws.setOpUsersModalOpen(false);
  };

  const entitySubtitle = ws.selectedDimension?.label?.trim() || undefined;

  return (
    <RoleLinkUsersModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      roleOrder={ENTITY_LINK_ROLE_KEYS}
      columns={ENTITY_LINK_ROLE_COLUMNS}
      pickers={pickersQ.data}
      local={draft}
      setLocal={setDraft}
      search={search}
      setSearch={setSearch}
      subtitle={entitySubtitle}
      doneLabel="Сохранить"
      donePending={saveMut.isPending || detailQ.isLoading}
      onCancel={close}
      onDone={() => void saveMut.mutateAsync()}
    />
  );
}
