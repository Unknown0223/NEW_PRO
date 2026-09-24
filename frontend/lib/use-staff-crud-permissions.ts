"use client";

import { useMemo } from "react";
import { usePermissions } from "@/lib/use-permissions";

/** Access structured section under `staff.<section>.*` */
export type StaffCrudSection =
  | "agent"
  | "supervayzer"
  | "ekspeditor"
  | "inkassator"
  | "auditor"
  | "skladchik"
  | "sotrudniki";

export type StaffCrudPermissions = {
  isLoading: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canActivate: boolean;
  canDeactivate: boolean;
  canExport: boolean;
  canImport: boolean;
  /** Password / edit / deactivate dan kamida bittasi */
  canAnyRowAction: boolean;
};

/**
 * KOMANDA spravochnik UI: Dostup kalitlariga qarab tugmalar.
 * `admin` — usePermissions ichida always true.
 * Default-deny: loading paytida false.
 */
export function useStaffCrudPermissions(section: StaffCrudSection): StaffCrudPermissions {
  const { has, hasAny, isLoading } = usePermissions();

  return useMemo(() => {
    if (isLoading) {
      return {
        isLoading: true,
        canCreate: false,
        canUpdate: false,
        canActivate: false,
        canDeactivate: false,
        canExport: false,
        canImport: false,
        canAnyRowAction: false
      };
    }
    const base = `staff.${section}`;
    const canCreate = has(`${base}.create`);
    const canUpdate = has(`${base}.update`);
    const canActivate = has(`${base}.activate`);
    const canDeactivate = has(`${base}.deactivate`) || canActivate;
    const canExport = hasAny(`${base}.history`, `${base}.copy`);
    const canImport = canCreate || canUpdate;
    return {
      isLoading: false,
      canCreate,
      canUpdate,
      canActivate,
      canDeactivate,
      canExport,
      canImport,
      canAnyRowAction: canUpdate || canDeactivate || canActivate
    };
  }, [has, hasAny, isLoading, section]);
}
