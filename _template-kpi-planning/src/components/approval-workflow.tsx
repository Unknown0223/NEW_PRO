"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getRoleLabel, getStatusColor, getStatusLabel, cn } from "@/lib/utils";
import { CheckCircle2, Clock, ArrowDown, User, Calendar, MessageSquare } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  role: string;
  avatar: string | null;
}

interface Approval {
  id: number;
  planId: number;
  step: number;
  approverId: number;
  approverRole: string;
  status: string;
  comment: string | null;
  createdAt: Date | null;
  actedAt: Date | null;
}

interface ApprovalWorkflowProps {
  employees: Employee[];
  approvals: Approval[];
}

export function ApprovalWorkflow({ employees, approvals }: ApprovalWorkflowProps) {
  const sortedApprovals = [...approvals].sort((a, b) => a.step - b.step);
  const completedSteps = sortedApprovals.filter((a) => a.status === "approved").length;
  const progress = sortedApprovals.length > 0 ? (completedSteps / sortedApprovals.length) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Согласование</h3>
        <Badge variant="outline" className={cn("text-xs", getStatusColor("pending_approval"))}>
          Шаг {completedSteps + 1} из {sortedApprovals.length}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Цепочка согласования</CardTitle>
            <span className="text-xs text-slate-500">{Math.round(progress)}% завершено</span>
          </div>
          <Progress value={progress} size="md" variant={progress >= 80 ? "success" : "warning"} />
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedApprovals.map((approval, index) => {
            const approver = employees.find((e) => e.id === approval.approverId);
            const isLast = index === sortedApprovals.length - 1;
            const isApproved = approval.status === "approved";
            const isPending = approval.status === "pending_approval";
            const isRejected = approval.status === "rejected";

            return (
              <div key={approval.id}>
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2",
                        isApproved
                          ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                          : isRejected
                          ? "border-red-500 bg-red-50 text-red-600"
                          : isPending
                          ? "border-amber-500 bg-amber-50 text-amber-600"
                          : "border-slate-300 bg-slate-50 text-slate-400"
                      )}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : isRejected ? (
                        <MessageSquare className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    {!isLast && (
                      <div className="absolute left-1/2 top-10 h-6 w-0.5 -translate-x-1/2 bg-slate-200" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar src={approver?.avatar} fallback={approver?.name || "?"} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{approver?.name || "Неизвестно"}</p>
                          <p className="text-xs text-slate-500">{getRoleLabel(approval.approverRole)}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-xs", getStatusColor(approval.status))}>
                        {getStatusLabel(approval.status)}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        ID: {approval.approverId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {approval.actedAt
                          ? new Date(approval.actedAt).toLocaleDateString("ru-RU")
                          : "Ожидает"}
                      </span>
                      {approval.comment && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <MessageSquare className="h-3 w-3" />
                          {approval.comment}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
