import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import OrdersTable from './components/OrdersTable';
import StatisticsRow from './components/StatisticsRow';
import FilterBar from './components/FilterBar';
import { useOrders } from './hooks/useOrders';

const kassas = ['Касса', 'Касса 1', 'Касса 2', 'Долг по кассе', 'Все кассы'];

export default function App() {
  const {
    orders,
    filters,
    statistics,
    onSuccessCount,
    onUpdateOrder,
    setFilters,
  } = useOrders();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader title="Приход в кассу" />

        <main className="flex-1 p-4 lg:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-800">Приход в кассу</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">
                Записей: <span className="font-medium text-slate-700">{orders.length}</span>
              </span>
            </div>
          </div>

          <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
            <OrdersTable
              orders={orders}
              onUpdateOrder={onUpdateOrder}
            />
            <StatisticsRow statistics={statistics} />
          </div>

          <FilterBar
            filters={filters}
            onChange={setFilters}
            kassas={kassas}
            onSuccessCount={onSuccessCount}
            totalCount={orders.length}
          />
        </main>
      </div>
    </div>
  );
}
