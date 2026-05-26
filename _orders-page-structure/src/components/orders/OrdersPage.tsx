import React, { useState, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  FileSpreadsheet,
  Plus,
  ListFilter,
  LayoutList,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { OrdersFilters } from './OrdersFilters';
import { OrdersTable } from './OrdersTable';
import { BulkActions } from './BulkActions';
import { UploadModal } from './UploadModal';
import { mockOrders } from '@/data/mockOrders';
import type { Order, OrderStatus, FilterState } from '@/types/order';

const defaultFilters: FilterState = {
  dateFrom: '2026-04-24',
  dateTo: '2026-05-24',
  dateType: 'order',
  status: '',
  type: '',
  invoiceType: '',
  paymentType: '',
  priceType: '',
  day: '',
  clientCategory: '',
  client: '',
  productCategory: '',
  product: '',
  warehouse: '',
  agent: '',
  expediter: '',
  consignment: '',
  tradeDirection: '',
  zone: '',
  region: '',
  city: '',
};

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [uploadModal, setUploadModal] = useState<{ open: boolean; title: string }>({ open: false, title: '' });

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (filters.status) {
      result = result.filter((o) => o.status === filters.status);
    }
    if (filters.type) {
      result = result.filter((o) => o.type === filters.type);
    }
    if (filters.paymentType) {
      result = result.filter((o) => o.paymentType === filters.paymentType);
    }
    if (filters.warehouse) {
      result = result.filter((o) => o.warehouse === filters.warehouse);
    }
    if (filters.agent) {
      result = result.filter((o) => o.agent === filters.agent);
    }
    if (filters.region) {
      result = result.filter((o) => o.region === filters.region);
    }
    if (filters.city) {
      result = result.filter((o) => o.city === filters.city);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.number.includes(q) ||
          o.client.toLowerCase().includes(q) ||
          o.phone.includes(q) ||
          o.agent.toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, filters, searchQuery]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  const handleSelectRow = useCallback((id: string, selected: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedRows(new Set(paginatedOrders.map((o) => o.id)));
      } else {
        setSelectedRows(new Set());
      }
    },
    [paginatedOrders]
  );

  const handleStatusChange = useCallback((id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }, []);

  const handleRowAction = useCallback((orderId: string, action: string) => {
    switch (action) {
      case 'create_return_by_order':
        alert(`Создание возврата по заказу ${orderId}\n\nZakazdan qaytarish yaratilmoqda...\n1. Yangi RETURN_BY_ORDER tipidagi zakaz ochiladi\n2. Status: В процессе возврата\n3. Mahsulotlar ro'yxati ko'chiriladi\n4. Ombor qaytarishni tasdiqlaydi`);
        break;
      case 'change_delivery_date':
        alert(`Изменить дату доставки для ${orderId}`);
        break;
      case 'change_ship_date':
        alert(`Изменить ожидаемую дату отгрузки для ${orderId}`);
        break;
      default:
        alert(`Действие: ${action} для заказа ${orderId}`);
    }
  }, []);

  const handleOpenUploadModal = useCallback((title: string) => {
    setUploadModal({ open: true, title });
  }, []);

  const handleUploadDownload = useCallback((template: string) => {
    alert(`Yuklanmoqda: ${template}\n\nFayl avtomatik yuklab olinadi...`);
  }, []);

  const handleBulkStatusChange = useCallback(
    (status: string) => {
      setOrders((prev) =>
        prev.map((o) => (selectedRows.has(o.id) ? { ...o, status: status as OrderStatus } : o))
      );
      setSelectedRows(new Set());
    },
    [selectedRows]
  );

  const handleRowClick = useCallback((id: string) => {
    alert(`Открыть детали заказа: /orders/details/${id}`);
  }, []);

  const handleRefresh = useCallback(() => {
    setOrders([...mockOrders]);
    setPage(1);
  }, []);

  const handleExport = useCallback(() => {
    alert('Экспорт в Excel...');
  }, []);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between h-12 px-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="text-sm text-gray-500">Нет избранные страницы</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
            <span className="text-xs font-medium text-gray-600">AU</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Заявки</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#14b8a6] hover:bg-[#0d9488] rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Создать заказ
            </button>
          </div>
        </div>

        {/* Filters */}
        <OrdersFilters
          filters={filters}
          onChange={setFilters}
          onApply={() => setPage(1)}
          onReset={() => {
            setFilters(defaultFilters);
            setPage(1);
          }}
        />

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-3 bg-white rounded-lg border border-gray-200 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <LayoutList className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <ListFilter className="w-4 h-4" />
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 appearance-none cursor-pointer pr-7"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <div className="relative ml-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500 w-56"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <OrdersTable
          orders={paginatedOrders}
          selectedRows={selectedRows}
          onSelectRow={handleSelectRow}
          onSelectAll={handleSelectAll}
          onStatusChange={handleStatusChange}
          onAction={handleRowAction}
          onRowClick={handleRowClick}
        />

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="flex items-center justify-between mt-3 bg-white rounded-lg border border-gray-200 px-4 py-2.5">
            <div className="text-sm text-gray-500">
              Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredOrders.length)} / {filteredOrders.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[32px] h-8 px-1.5 text-sm font-medium rounded transition-colors ${
                      page === pageNum
                        ? 'bg-[#14b8a6] text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Actions - shows only when rows selected */}
      <BulkActions
        selectedCount={selectedRows.size}
        onClose={() => setSelectedRows(new Set())}
        onChangeStatus={handleBulkStatusChange}
        onDeliveryAssign={() => alert(`Прикрепить доставщика для ${selectedRows.size} заказов`)}
        onOrderSummary={() => alert(`Итог по ${selectedRows.size} заказам`)}
        onConsignment={() => alert(`Изменение консигнации для ${selectedRows.size} заказов`)}
        onCashIncome={() => alert(`${selectedRows.size} ta zakaz — «Приход в кассу» jadvalida naqd ustuniga taqsimlangan.`)}
        onOpenUploadModal={handleOpenUploadModal}
      />

      {/* Upload Modal */}
      <UploadModal
        open={uploadModal.open}
        onClose={() => setUploadModal({ open: false, title: '' })}
        title={uploadModal.title}
        selectedCount={selectedRows.size}
        onDownload={handleUploadDownload}
      />
    </div>
  );
};
