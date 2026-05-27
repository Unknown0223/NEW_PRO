import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RefusalsPage from './pages/RefusalsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import UserDetailPage from './pages/UserDetailPage';
import Sidebar from './components/Sidebar';

// Generic placeholder page
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
              <path d="M9 9h6M9 12h6M9 15h4" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
          <p className="text-sm text-gray-500">Страница в разработке</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to refusals */}
        <Route path="/" element={<Navigate to="/orders/refusals" replace />} />

        {/* Refusals page */}
        <Route path="/orders/refusals" element={<RefusalsPage />} />

        {/* Client detail */}
        <Route path="/clients/about-clients/:id" element={<ClientDetailPage />} />

        {/* User/Agent detail */}
        <Route path="/users/:id" element={<UserDetailPage />} />

        {/* Placeholder routes */}
        <Route path="/orders" element={<PlaceholderPage title="Заявки" />} />
        <Route path="/orders/create" element={<PlaceholderPage title="Создать заказ" />} />
        <Route path="/orders/return-shelf" element={<PlaceholderPage title="Возврат с полки" />} />
        <Route path="/orders/return-shelf-by-order" element={<PlaceholderPage title="Возврат по заказу" />} />
        <Route path="/orders/suggestions" element={<PlaceholderPage title="Предложения" />} />
        <Route path="/orders/automation" element={<PlaceholderPage title="Автоматизация" />} />
        <Route path="/clients" element={<PlaceholderPage title="Клиенты" />} />
        <Route path="/invoices" element={<PlaceholderPage title="Накладные" />} />
        <Route path="/cash" element={<PlaceholderPage title="Касса" />} />
        <Route path="/warehouse" element={<PlaceholderPage title="Склад" />} />
        <Route path="/suppliers" element={<PlaceholderPage title="Поставщики" />} />
        <Route path="/plans" element={<PlaceholderPage title="Планы" />} />
        <Route path="/reports" element={<PlaceholderPage title="Отчёты" />} />
        <Route path="/pivot" element={<PlaceholderPage title="Pivot отчеты" />} />
        <Route path="/users" element={<PlaceholderPage title="Пользователи" />} />
        <Route path="/audit" element={<PlaceholderPage title="Аудит" />} />
        <Route path="/access" element={<PlaceholderPage title="Доступ" />} />
        <Route path="/settings" element={<PlaceholderPage title="Настройки" />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/orders/refusals" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
