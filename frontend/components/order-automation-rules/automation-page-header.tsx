"use client";

import { Plus } from "lucide-react";

type TabId = "restrictions" | "auto-confirm";

export function AutomationPageHeader({
  activeTab,
  onTabChange,
  onCreateClick
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  onCreateClick: () => void;
}) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-lg font-semibold text-gray-800">Автоматизация заявок</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => onTabChange("restrictions")}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                activeTab === "restrictions"
                  ? "bg-teal-600 text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Ограничение заявок
            </button>
            <button
              type="button"
              onClick={() => onTabChange("auto-confirm")}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                activeTab === "auto-confirm"
                  ? "bg-teal-600 text-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Авто-подтверждение
            </button>
          </div>
          <button
            type="button"
            onClick={onCreateClick}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-teal-700"
          >
            <Plus size={16} />
            Создать
          </button>
        </div>
      </div>
    </div>
  );
}
