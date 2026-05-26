import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { filterOptions } from '@/data/mockOrders';
import type { FilterState } from '@/types/order';

interface OrdersFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
}

export const OrdersFilters: React.FC<OrdersFiltersProps> = ({
  filters,
  onChange,
  onApply,
  onReset,
}) => {
  const update = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
      {/* Date type radios + date pickers in one row */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-5">
          <span className="text-sm text-gray-600">Дата применяется по</span>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700">
            <input
              type="radio"
              name="dateType"
              checked={filters.dateType === 'order'}
              onChange={() => update('dateType', 'order')}
              className="w-4 h-4 accent-teal-600"
            />
            Дата заказа
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700">
            <input
              type="radio"
              name="dateType"
              checked={filters.dateType === 'ship'}
              onChange={() => update('dateType', 'ship')}
              className="w-4 h-4 accent-teal-600"
            />
            Дата отправки
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer text-gray-700">
            <input
              type="radio"
              name="dateType"
              checked={filters.dateType === 'created'}
              onChange={() => update('dateType', 'created')}
              className="w-4 h-4 accent-teal-600"
            />
            Дата создания
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Дата</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update('dateFrom', e.target.value)}
            className="h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update('dateTo', e.target.value)}
            className="h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Row 1: 7 filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-2.5">
        <Select
          options={[{ value: '', label: 'Все статусы' }, ...filterOptions.status.filter((s) => s.value)]}
          value={filters.status}
          onChange={(v) => update('status', v)}
          placeholder="Все статусы"
        />
        <Select
          options={[{ value: '', label: 'Все типы' }, ...filterOptions.type.filter((s) => s.value)]}
          value={filters.type}
          onChange={(v) => update('type', v)}
          placeholder="Все типы"
        />
        <Select
          options={filterOptions.invoiceType}
          value={filters.invoiceType}
          onChange={(v) => update('invoiceType', v)}
          placeholder="Все типы накладной"
        />
        <Select
          options={filterOptions.paymentType}
          value={filters.paymentType}
          onChange={(v) => update('paymentType', v)}
          placeholder="Все способы оплаты"
        />
        <Select
          options={filterOptions.priceType}
          value={filters.priceType}
          onChange={(v) => update('priceType', v)}
          placeholder="Все типы цен"
        />
        <Select
          options={filterOptions.day}
          value={filters.day}
          onChange={(v) => update('day', v)}
          placeholder="Все дни"
        />
        <Select
          options={filterOptions.clientCategory}
          value={filters.clientCategory}
          onChange={(v) => update('clientCategory', v)}
          placeholder="Все категории"
        />
      </div>

      {/* Row 2: 7 filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-2.5">
        <Select
          options={[{ value: '', label: 'Все клиенты' }]}
          value={filters.client}
          onChange={(v) => update('client', v)}
          placeholder="Все клиенты"
        />
        <Select
          options={[
            { value: '', label: 'Все категории' },
            { value: 'cat1', label: 'Категория 1' },
            { value: 'cat2', label: 'Категория 2' },
          ]}
          value={filters.productCategory}
          onChange={(v) => update('productCategory', v)}
          placeholder="Все категории"
        />
        <Select
          options={[
            { value: '', label: 'Все продукты' },
            { value: 'prod1', label: 'Продукт 1' },
            { value: 'prod2', label: 'Продукт 2' },
          ]}
          value={filters.product}
          onChange={(v) => update('product', v)}
          placeholder="Все продукты"
        />
        <Select
          options={filterOptions.warehouse}
          value={filters.warehouse}
          onChange={(v) => update('warehouse', v)}
          placeholder="Все склады"
        />
        <Select
          options={filterOptions.agent}
          value={filters.agent}
          onChange={(v) => update('agent', v)}
          placeholder="Все агенты"
        />
        <Select
          options={filterOptions.expediter}
          value={filters.expediter}
          onChange={(v) => update('expediter', v)}
          placeholder="Все экспедиторы"
        />
        <Select
          options={filterOptions.consignment}
          value={filters.consignment}
          onChange={(v) => update('consignment', v)}
          placeholder="Все консигнации"
        />
      </div>

      {/* Row 3: 4 filters + buttons */}
      <div className="flex items-center gap-2.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 flex-1">
          <Select
            options={filterOptions.tradeDirection}
            value={filters.tradeDirection}
            onChange={(v) => update('tradeDirection', v)}
            placeholder="Все направления"
          />
          <Select
            options={filterOptions.zone}
            value={filters.zone}
            onChange={(v) => update('zone', v)}
            placeholder="Все зоны"
          />
          <Select
            options={filterOptions.region}
            value={filters.region}
            onChange={(v) => update('region', v)}
            placeholder="Все области"
          />
          <Select
            options={filterOptions.city}
            value={filters.city}
            onChange={(v) => update('city', v)}
            placeholder="Все города"
          />
        </div>
        <button
          onClick={onReset}
          className="flex items-center justify-center w-10 h-10 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          title="Сбросить"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onApply}
          className="flex items-center gap-1.5 px-5 h-10 text-sm font-medium text-white bg-[#14b8a6] hover:bg-[#0d9488] rounded-lg transition-colors flex-shrink-0"
        >
          <Search className="w-4 h-4" />
          Применить
        </button>
      </div>
    </div>
  );
};
