import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  orderId as mockOrderId,
  orderVersions as mockOrderVersions,
  products as mockProducts,
  bonusHistory as mockBonusHistory,
} from '../data/mockData';
import type { OrderVersion, ProductItem, BonusEntry } from '../data/mockData';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import OrderInfoSection from '../components/OrderInfoSection';
import BonusHistory from '../components/BonusHistory';
import AuditSection from '../components/AuditSection';
import ActionsBar from '../components/ActionsBar';

export default function OrderHistoryPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const displayOrderId = uuid || mockOrderId;
  const navigate = useNavigate();

  const [history, setHistory] = useState<OrderVersion[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [bonusHistory, setBonusHistory] = useState<BonusEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Simulate API
      await new Promise((resolve) => setTimeout(resolve, 400));
      setHistory(mockOrderVersions);
      setProducts(mockProducts);
      setBonusHistory(mockBonusHistory);
      setLoading(false);
    };
    fetchData();
  }, [displayOrderId]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-[#f3f4f6]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-teal-600" />
              <span className="text-sm text-gray-500">Загрузка...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f3f4f6]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-6">
            {/* Page Header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
                <h1 className="text-xl font-bold text-gray-900">История заказа</h1>
                <span className="text-base font-bold text-teal-700">
                  ИД заказа ({displayOrderId})
                </span>
              </div>
              <ActionsBar />
            </div>

            {/* Content */}
            <div className="space-y-5">
              {/* Audit */}
              <AuditSection data={history} />

              {/* Order Info Table (includes status row + Состав) */}
              <OrderInfoSection data={history} products={products} />

              {/* Bonus History */}
              <div>
                <h3 className="mb-3 text-lg font-bold text-gray-900">История бонусов</h3>
                <BonusHistory data={bonusHistory} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
