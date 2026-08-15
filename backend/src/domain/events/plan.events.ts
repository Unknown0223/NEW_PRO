/** Reja / workflow domain eventlari. */

export const PLAN_EVENT_CHANNEL = "plan-events" as const;

export const PlanEventNames = {
  APPROVER_UPDATED: "plan.approver_updated",
  WORKFLOW_CHANGED: "plan.workflow_changed"
} as const;

export type PlanEventName = (typeof PlanEventNames)[keyof typeof PlanEventNames];

export type PlanApproverUpdatedPayload = {
  type: typeof PlanEventNames.APPROVER_UPDATED;
  tenant_id: number;
  workflow_id: number;
};

export type PlanWorkflowChangedPayload = {
  type: typeof PlanEventNames.WORKFLOW_CHANGED;
  tenant_id: number;
  workflow_id: number;
};

export type PlanEventPayload = PlanApproverUpdatedPayload | PlanWorkflowChangedPayload;

export function createPlanApproverUpdatedPayload(
  tenantId: number,
  workflowId: number
): PlanApproverUpdatedPayload {
  return {
    type: PlanEventNames.APPROVER_UPDATED,
    tenant_id: tenantId,
    workflow_id: workflowId
  };
}
