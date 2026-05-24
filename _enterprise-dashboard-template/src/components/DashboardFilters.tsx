import { useMemo } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { Calendar, Filter, X } from 'lucide-react'

const MultiSelect = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (values: string[]) => void
}) => {
  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = value.includes(option)
          return (
            <button
              key={option}
              onClick={() => toggleOption(option)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DashboardFilters() {
  const { filters, setFilters, resetFilters } = useDashboardStore()

  const allOptions = useMemo(() => ({
    paymentMethods: ['Наличные', 'Терминал', 'Банковский перевод', 'Тенге'],
    agents: ['Алиев А.', 'Иванов П.', 'Петров С.', 'Смагулов Д.', 'Козлов М.'],
    supervisors: ['Смирнов К.', 'Васильев А.', 'Петров Д.'],
    tradeDirections: ['Опт', 'Розница', 'HoReCa'],
    customerCategories: ['Категория А', 'Категория Б', 'Категория В'],
    zones: ['Центральная', 'Северная', 'Южная', 'Восточная', 'Западная'],
    regions: ['Алматы', 'Астана', 'Шымкент', 'Актау', 'Атырау'],
    cities: ['Алматы', 'Астана', 'Шымкент', 'Тараз', 'Павлодар'],
  }), [])

  const hasActiveFilters = useMemo(() => {
    return (
      filters.paymentMethods.length > 0 ||
      filters.agents.length > 0 ||
      filters.supervisors.length > 0 ||
      filters.tradeDirections.length > 0 ||
      filters.customerCategories.length > 0 ||
      filters.zones.length > 0 ||
      filters.regions.length > 0 ||
      filters.cities.length > 0
    )
  }, [filters])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">Фильтры</h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <X className="h-4 w-4" />
            Сбросить
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Date Range */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-600 uppercase tracking-wide">
            Период
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ startDate: e.target.value })}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ endDate: e.target.value })}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Payment Methods */}
        <MultiSelect
          label="Способ оплаты"
          options={allOptions.paymentMethods}
          value={filters.paymentMethods}
          onChange={(values) => setFilters({ paymentMethods: values })}
        />

        {/* Trade Directions */}
        <MultiSelect
          label="Направление торговли"
          options={allOptions.tradeDirections}
          value={filters.tradeDirections}
          onChange={(values) => setFilters({ tradeDirections: values })}
        />

        {/* Customer Categories */}
        <MultiSelect
          label="Категория клиента"
          options={allOptions.customerCategories}
          value={filters.customerCategories}
          onChange={(values) => setFilters({ customerCategories: values })}
        />

        {/* Zones */}
        <MultiSelect
          label="Зона"
          options={allOptions.zones}
          value={filters.zones}
          onChange={(values) => setFilters({ zones: values })}
        />

        {/* Regions */}
        <MultiSelect
          label="Область"
          options={allOptions.regions}
          value={filters.regions}
          onChange={(values) => setFilters({ regions: values })}
        />

        {/* Cities */}
        <MultiSelect
          label="Город"
          options={allOptions.cities}
          value={filters.cities}
          onChange={(values) => setFilters({ cities: values })}
        />

        {/* Agents */}
        <MultiSelect
          label="Агент"
          options={allOptions.agents}
          value={filters.agents}
          onChange={(values) => setFilters({ agents: values })}
        />

        {/* Supervisors */}
        <MultiSelect
          label="Супервайзеры"
          options={allOptions.supervisors}
          value={filters.supervisors}
          onChange={(values) => setFilters({ supervisors: values })}
        />
      </div>
    </div>
  )
}
