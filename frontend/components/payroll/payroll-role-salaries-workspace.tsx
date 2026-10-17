"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, payrollApi, type Ym } from "@/lib/payroll/payroll-api";
import { useNotice } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PayrollEmployeeConfigs, roleAllowanceColumns } from "@/components/payroll/payroll-employee-configs";
import { PayrollPageTitle } from "@/components/payroll/kit/payroll-kit-layout";
import { PayrollKpiGridTemplate } from "@/components/payroll/payroll-kpi-grid-template";
import { PayrollPickMonth } from "@/components/payroll/kit/payroll-kit-picker";
import { PAYROLL_SECONDARY_BTN } from "@/components/payroll/kit/payroll-kit-table";

type RoleConfig = {
  role: string;
  allowance_item_ids: number[];
  employees: number;
};

export function PayrollRoleSalariesWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const notice = useNotice();
  const [role, setRole] = useState("");
  const [scope, setScope] = useState({ branch: "", direction: "" });
  const [importOpen, setImportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [ym, setYm] = useState<Ym>(currentYm());
  const qc = useQueryClient();

  const rolesQ = useQuery({
    queryKey: ["payroll-role-configs", tenant, ym.year, ym.month],
    enabled: Boolean(tenant),
    queryFn: () => api.get<RoleConfig[]>(`/role-configs?year=${ym.year}&month=${ym.month}`)
  });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const roles = useMemo(() => rolesQ.data ?? [], [rolesQ.data]);
  const config = roles.find((r) => r.role === role);
  const columns = useMemo(
    () => roleAllowanceColumns(itemsQ.data ?? [], role ? config?.allowance_item_ids : undefined),
    [itemsQ.data, role, config?.allowance_item_ids]
  );

  return (
    <PageShell className="payroll-template">
      <PayrollPageTitle
        title="Базовые оклады"
        description="FIX и ручные надбавки — сумма за месяц: в зарплате умножаются на отработанные дни табеля. Новую колонку (например, топливо) добавляют в «1. Надбавки и вычеты» с расчётом «Вручную»."
        actions={
          <>
            <PayrollPickMonth value={ym} onChange={setYm} />
            <button type="button" className={PAYROLL_SECONDARY_BTN} onClick={() => setTemplateOpen(true)}>
              Сетка Excel
            </button>
            {canEdit ? (
              <Button
                variant="outline"
                onClick={() => {
                  const from = ym.month === 1 ? { year: ym.year - 1, month: 12 } : { year: ym.year, month: ym.month - 1 };
                  void api.send<{ copied: number }>("POST", "/grids/copy", { from, to: ym }).then(
                    (r) => {
                      notice.ok(`Сетка ${from.month}.${from.year} скопирована в ${ym.month}.${ym.year}: ${r.copied}`);
                      void qc.invalidateQueries({ queryKey: ["payroll-role-configs", tenant] });
                      void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });
                    },
                    (e) => notice.fail(e)
                  );
                }}
              >
                С прошлого месяца
              </Button>
            ) : null}
          </>
        }
      />
      {notice.element}
      <PayrollEmployeeConfigs
        role={role}
        onRoleChange={setRole}
        onScopeChange={setScope}
        columns={columns}
        ym={ym}
        importOpen={importOpen}
        onImportOpenChange={setImportOpen}
        onNotice={notice}
      />
      <PayrollKpiGridTemplate
        open={templateOpen}
        year={ym.year}
        month={ym.month}
        roles={roles}
        filter={{ role, branch: scope.branch, direction: scope.direction }}
        onClose={() => setTemplateOpen(false)}
        onDone={notice.ok}
        onFail={notice.fail}
      />
    </PageShell>
  );
}
