import { useState } from 'react';
import { Sidebar, type RouteId } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { CreateReturnPage } from './pages/returns/CreateReturnPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import {
  OrdersListPage, ClientsPage, WarehousePage, ReportsPage, PlaceholderPage,
} from './pages/SimplePages';

export default function App() {
  const [route, setRoute] = useState<RouteId>('orders.return-shelf');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        current={route}
        onNavigate={setRoute}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 min-w-0">
          {renderRoute(route)}
        </main>
      </div>
    </div>
  );
}

function renderRoute(r: RouteId) {
  switch (r) {
    case 'dashboard': return <DashboardPage />;
    case 'orders.create': return <PlaceholderPage title="Создать заказ" />;
    case 'orders.return-shelf': return <CreateReturnPage />;
    case 'orders.return-shelf-order': return <PlaceholderPage title="Создать возврат с полки по заказа" />;
    case 'orders.list': return <OrdersListPage />;
    case 'orders.refused': return <PlaceholderPage title="Отказы" />;
    case 'orders.offer': return <PlaceholderPage title="Предложение для создания заказа" />;
    case 'orders.automation': return <PlaceholderPage title="Автоматизация заявок" />;
    case 'clients': return <ClientsPage />;
    case 'invoices': return <PlaceholderPage title="Накладные" />;
    case 'cash': return <PlaceholderPage title="Касса" />;
    case 'warehouse': return <WarehousePage />;
    case 'suppliers': return <PlaceholderPage title="Поставщики" />;
    case 'plans': return <PlaceholderPage title="Планы" />;
    case 'reports': return <ReportsPage />;
    case 'pivot': return <PlaceholderPage title="Pivot отчёты" />;
    case 'users': return <PlaceholderPage title="Пользователи" />;
    default: return <DashboardPage />;
  }
}
