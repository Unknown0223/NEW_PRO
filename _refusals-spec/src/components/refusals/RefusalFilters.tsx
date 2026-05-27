import { RefusalFiltersState } from '../../types/refusal';
import {
  agentOptions,
  reasonOptions,
  clientCategoryOptions,
  zoneOptions,
  regionOptions,
  cityOptions,
} from '../../data/mockRefusals';
import { Check } from 'lucide-react';

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

function FilterSelect({ label, value, options, onChange }: SelectProps) {
  return (
    <div className="relative flex-1 min-w-[120px] max-w-[180px]">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none bg-white border rounded-lg px-3 py-2 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 cursor-pointer hover:border-gray-300 transition-all ${
          value ? 'border-teal-300 text-gray-800 font-medium' : 'border-gray-200 text-gray-500'
        }`}
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}

interface RefusalFiltersProps {
  filters: RefusalFiltersState;
  onFiltersChange: (filters: RefusalFiltersState) => void;
  onApply: () => void;
}

export default function RefusalFilters({
  filters,
  onFiltersChange,
  onApply,
}: RefusalFiltersProps) {
  const set = (key: keyof RefusalFiltersState) => (value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.agent || filters.reason || filters.clientCategory || filters.zone || filters.region || filters.city;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex-shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        {/* Agent */}
        <FilterSelect
          label="Агент"
          value={filters.agent}
          options={agentOptions}
          onChange={set('agent')}
        />

        {/* Reason */}
        <FilterSelect
          label="Причины отказа"
          value={filters.reason}
          options={reasonOptions}
          onChange={set('reason')}
        />

        {/* Client category */}
        <FilterSelect
          label="Категория клиента"
          value={filters.clientCategory}
          options={clientCategoryOptions}
          onChange={set('clientCategory')}
        />

        {/* Zone */}
        <FilterSelect
          label="Зона"
          value={filters.zone}
          options={zoneOptions}
          onChange={set('zone')}
        />

        {/* Region */}
        <FilterSelect
          label="Область"
          value={filters.region}
          options={regionOptions}
          onChange={set('region')}
        />

        {/* City */}
        <FilterSelect
          label="Город"
          value={filters.city}
          options={cityOptions}
          onChange={set('city')}
        />

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() =>
              onFiltersChange({
                ...filters,
                agent: '',
                reason: '',
                clientCategory: '',
                zone: '',
                region: '',
                city: '',
              })
            }
            className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
          >
            Сбросить
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Apply Button */}
        <button
          onClick={onApply}
          className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white px-5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm whitespace-nowrap"
        >
          <Check size={13} />
          Применить
        </button>
      </div>
    </div>
  );
}
