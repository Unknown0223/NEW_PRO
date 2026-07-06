"use client";

import { Button } from "@/components/ui/button";
import {
  Save,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  FileSpreadsheet,
  History,
} from "lucide-react";

interface ActionFooterProps {
  onSaveDraft: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestRevision: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}

export function ActionFooter({
  onSaveDraft,
  onSubmit,
  onApprove,
  onReject,
  onRequestRevision,
  onDuplicate,
  onExport,
}: ActionFooterProps) {
  return (
    <div className="sticky bottom-0 z-30 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm p-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onSaveDraft}>
            <Save className="h-3.5 w-3.5" />
            Сохранить черновик
          </Button>
          <Button variant="default" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={onSubmit}>
            <Send className="h-3.5 w-3.5" />
            Отправить
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={onApprove}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Утвердить
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50" onClick={onReject}>
            <XCircle className="h-3.5 w-3.5" />
            Отклонить
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50" onClick={onRequestRevision}>
            <RotateCcw className="h-3.5 w-3.5" />
            На доработку
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
            Дублировать
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>
    </div>
  );
}
