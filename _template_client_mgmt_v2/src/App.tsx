import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ClientsFilters } from './components/ClientsFilters';
import { ClientsToolbar } from './components/ClientsToolbar';
import { ClientsTable } from './components/ClientsTable';
import { Pagination } from './components/Pagination';
import { useClientStore } from './store/useClientStore';

const queryClient = new QueryClient();

function ClientsPage() {
  const { setFilters, resetFilters } = useClientStore();
  const [filtersState, setFiltersState] = useState<Record<string, string[]>>({});

  const handleSetFilters = (f: Record<string, string[]>) => {
    setFiltersState(f);
    setFilters(f);
  };

  const handleReset = () => {
    setFiltersState({});
    resetFilters();
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex">
      <Sidebar />

      <main className="flex-1 ml-64 min-w-0 flex flex-col min-h-screen">
        <Header />

        <div className="flex-1 flex flex-col">
          {/* Filters panel */}
          <ClientsFilters
            filters={filtersState}
            setFilters={handleSetFilters}
            resetFilters={handleReset}
          />

          {/* Table section */}
          <div className="flex-1 p-6 space-y-4">
            <ClientsToolbar />

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <ClientsTable />
              <Pagination />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClientsPage />
    </QueryClientProvider>
  );
}

export default App;
