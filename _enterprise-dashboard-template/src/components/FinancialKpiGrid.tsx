import { useDashboardStore } from '../store/dashboardStore'
import { formatCurrency, formatLargeNumber } from '../utils/formatting'
import { DollarSign, CreditCard, Building2, Wallet, TrendingUp } from 'lucide-react'

const KpiCard = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string
  value: number
  icon: React.ElementType
  color: string
  subtitle?: string
}) => {
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatLargeNumber(value)}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-lg`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

export default function FinancialKpiGrid() {
  const kpis = useDashboardStore((state) => state.financialKpis)

  const total = kpis.totalSales
  const breakdown = [
    { label: 'Наличные', value: kpis.cash, color: 'emerald' as const },
    { label: 'Терминал', value: kpis.terminal, color: 'blue' as const },
    { label: 'Банковский перевод', value: kpis.bankTransfer, color: 'indigo' as const },
    { label: 'Тенге', value: kpis.tenge, color: 'amber' as const },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Финансовые KPI</h2>
        <span className="text-sm text-slate-500">Общая сумма</span>
      </div>

      {/* Total Sales Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm font-medium">Общая сумма продаж</p>
            <p className="mt-2 text-4xl font-bold">{formatCurrency(total)}</p>
            <p className="mt-2 text-indigo-200 text-sm">За выбранный период</p>
          </div>
          <TrendingUp className="h-16 w-16 text-indigo-300 opacity-50" />
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {breakdown.map((item) => (
          <KpiCard
            key={item.label}
            title={item.label}
            value={item.value}
            icon={item.label === 'Наличные' ? Wallet :
                   item.label === 'Терминал' ? CreditCard :
                   item.label === 'Банковский перевод' ? Building2 : DollarSign}
            color={item.color}
            subtitle={`${((item.value / total) * 100).toFixed(1)}% от общего`}
          />
        ))}
      </div>
    </div>
  )
}
