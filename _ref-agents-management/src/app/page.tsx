import Sidebar from "@/components/Sidebar";
import AgentsClient from "@/components/agents/AgentsClient";

export default function AgentsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <AgentsClient />
    </div>
  );
}
