import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OrderHistoryPage from './pages/OrderHistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/orders/orders/history/:uuid" element={<OrderHistoryPage />} />
        <Route path="*" element={<Navigate to="/orders/orders/history/1313943" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
