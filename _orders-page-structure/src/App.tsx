import { Sidebar } from '@/components/orders/Sidebar';
import { OrdersPage } from '@/components/orders/OrdersPage';
import { ToastProvider } from '@/components/ui/Toast';

function App() {
  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <OrdersPage />
      </div>
    </ToastProvider>
  );
}

export default App;
