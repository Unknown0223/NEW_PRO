import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ClientAuditTable from "./components/ClientAuditTable";
import ClientHistoryModal from "./components/ClientHistoryModal";

export default function App() {
  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex h-screen min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex shrink-0 items-center justify-between bg-white px-6 py-2.5 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              GPS
            </span>
            <span className="text-[15px] text-slate-500">Нет избранные страницы</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Timeline view button */}
            <button
              onClick={() => setTimelineOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              Timeline
            </button>
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
              <svg className="h-7 w-7 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2-7 5v1h14v-1c0-3-3-5-7-5z" />
              </svg>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          <ClientAuditTable />
        </main>
      </div>

      {timelineOpen && <ClientHistoryModal onClose={() => setTimelineOpen(false)} />}
    </div>
  );
}
