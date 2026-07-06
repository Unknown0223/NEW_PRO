import { useState } from "react";
import Sidebar from "./components/Sidebar";
import PaymentDetailPage from "./components/PaymentDetailPage";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar open={sidebarOpen} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-[260px]">
        <PaymentDetailPage onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      </div>
    </div>
  );
}
