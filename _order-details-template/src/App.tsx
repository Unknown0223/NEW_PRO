import { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import Breadcrumbs from './components/Breadcrumbs';
import OrderHeader from './components/OrderHeader';
import OrderInfoCard from './components/OrderInfoCard';
import ClientInfoCard from './components/ClientInfoCard';
import ProductsTable from './components/ProductsTable';
import OrderSummary from './components/OrderSummary';
import StatusSection from './components/StatusSection';
import BonusSection from './components/BonusSection';
import ActionsBar from './components/ActionsBar';

// Types
type OrderStatus = 'Новый' | 'Подтвержден' | 'Отгружен' | 'Доставлен' | 'Отменен';

interface Product {
  id: string;
  name: string;
  price: number;
  block: number;
  quantity: number;
  volume: number;
  discount: number;
  total: number;
}

interface BonusItem {
  id: string;
  name: string;
  quantity: number;
  amount: number;
}

// Mock Data
const mockOrder = {
  id: '1274827',
  agent: { id: 'agent-001', name: 'KIMSANOV ABDULAZIZ', code: 'JSQQ 008' },
  expeditor: { id: 'exp-001', name: 'Quqon Normatov Azizhon' },
  warehouse: { id: 'wh-001', name: 'Qoqon SKLAD' },
  createdAt: '31.03 12:15',
  shippedAt: '01.04 09:24',
  returnDate: '',
  tradeDirection: 'DIELUX',
  isConsignation: false,
  priceType: 'NAQD PUL',
  discount: 'Без скидки',
  location: { lat: 40.5585632, lng: 71.1434641 },
  bonus: 'Авто',
  comment: 'naxtga'
};

const mockClient = {
  id: 'client-001',
  name: 'BOZOR 56 DUKON',
  code: 'sr_20844',
  contactPerson: 'TOJIEVA XOJIRAXON',
  territory: 'YANGIQURGON',
  category: 'C',
  debt: 0,
  balance: -1051600,
  image: ''
};

const mockProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'Dielux 3D (10)',
    price: 13500,
    block: 21,
    quantity: 21,
    volume: 0,
    discount: 0,
    total: 283500
  }
];

const mockBonuses: BonusItem[] = [
  {
    id: 'bonus-001',
    name: 'Dielux 3D (10) J 7+2',
    quantity: 6,
    amount: 13500
  }
];

export default function App() {
  // State
  const [order, setOrder] = useState(mockOrder);
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [status, setStatus] = useState<OrderStatus>('Доставлен');
  const [editable, setEditable] = useState(false);

  // Calculate Summary
  const summary = useMemo(() => {
    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
    const totalWeight = products.reduce((sum, p) => sum + (p.quantity * 1), 0); // Mock weight calculation
    const totalVolume = products.reduce((sum, p) => sum + p.volume, 0);
    const totalAmount = products.reduce((sum, p) => {
      const baseTotal = p.quantity * p.price;
      return sum + (baseTotal - (baseTotal * p.discount / 100));
    }, 0);

    return {
      totalVolume,
      totalWeight,
      totalQuantity,
      totalAmount
    };
  }, [products]);

  // Calculate Bonus Total
  const totalBonusAmount = mockBonuses.reduce((sum, b) => sum + b.amount, 0);

  // Handlers
  const handleOrderEdit = (field: string, value: any) => {
    setOrder(prev => ({ ...prev, [field]: value }));
  };

  const handleProductUpdate = (productId: string, field: string, value: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updated = { ...p, [field]: value };
        // Recalculate total
        const baseTotal = updated.quantity * updated.price;
        updated.total = baseTotal - (baseTotal * updated.discount / 100);
        return updated;
      }
      return p;
    }));
  };

  const handleStatusChange = (newStatus: OrderStatus) => {
    setStatus(newStatus);
  };

  const handleUpdateStatus = () => {
    console.log('Status updated to:', status);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    console.log('Exporting PDF for order:', order.id);
  };

  const handleViewHistory = () => {
    console.log('Navigate to history:', `/orders/orders/history/${order.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Header */}
        <TopHeader />

        {/* Page Content */}
        <main className="p-6 pb-32">
          {/* Breadcrumbs */}
          <div className="mb-4">
            <Breadcrumbs
              items={[
                { label: 'Заявки', href: '/orders' },
                { label: `Заявка: ${order.id}` }
              ]}
            />
          </div>

          {/* Order Header */}
          <OrderHeader
            orderId={order.id}
            onViewHistory={handleViewHistory}
          />

          {/* Main Grid */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Left Column - Order Info */}
            <div className="col-span-2 space-y-6">
              <OrderInfoCard
                order={order}
                editable={editable}
                onEdit={handleOrderEdit}
              />

              {/* Client Info */}
              <ClientInfoCard client={mockClient} />

              {/* Products Table */}
              <ProductsTable
                products={products}
                editable={editable}
                onProductUpdate={handleProductUpdate}
              />
            </div>

            {/* Right Column - Summary & Actions */}
            <div className="space-y-4">
              {/* Status */}
              <StatusSection
                status={status}
                editable={editable}
                onStatusChange={handleStatusChange}
              />

              {/* Order Summary */}
              <OrderSummary summary={summary} />

              {/* Bonus Section */}
              <BonusSection
                bonuses={mockBonuses}
                autoBonus={order.bonus === 'Авто'}
                totalBonusAmount={totalBonusAmount}
              />
            </div>
          </div>
        </main>

        {/* Actions Bar */}
        <ActionsBar
          onUpdateStatus={handleUpdateStatus}
          onPrint={handlePrint}
          onExportPDF={handleExportPDF}
        />

        {/* Edit Toggle Button */}
        {!editable && (
          <button
            onClick={() => setEditable(true)}
            className="fixed bottom-24 right-6 w-12 h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
            title="Edit Order"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
