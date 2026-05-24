import { useDashboardStore } from '../store/dashboardStore'
import { formatNumber, formatPercent, formatCurrency } from '../utils/formatting'
import { Target, MapPin, Camera, ShoppingBag, DollarSign, ArrowRight } from 'lucide-react'

const FunnelStep = ({
  title,
  value,
  icon: Icon,
  color,
  percentage,
}: {
  title: string
  value: number
  icon: React.ElementType
  color: string
  percentage: number
}) => {
  const colorClasses: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-600',
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
  }

  const bgColors: Record<string, string> = {
    indigo: 'bg-indigo-50',
    blue: 'bg-blue-50',
    emerald: 'bg-emerald-50',
    amber: 'bg-amber-50',
    rose: 'bg-rose-50',
  }

  return (
    <div className="relative">
      <div className={`${bgColors[color]} rounded-xl p-5 border border-slate-200`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-lg`}>
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatNumber(value)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatPercent(percentage)} от плана
            </p>
          </div>
        </div>
      </div>

      {/* Arrow connector */}
      <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 hidden lg:block">
        <ArrowRight className="h-5 w-5 text-slate-300" />
      </div>
    </div>
  )
}

export default function SalesFunnel() {
  const funnel = useDashboardStore((state) => state.salesFunnel)

  const steps = [
    {
      title: 'Плановые Т.Т',
      value: funnel.plannedTT,
      total: funnel.plannedTT,
      icon: Target,
      color: 'indigo' as const,
      percentage: 100,
    },
    {
      title: 'Посещено Т.Т',
      value: funnel.visitedTT,
      total: funnel.plannedTT,
      icon: MapPin,
      color: 'blue' as const,
      percentage: (funnel.visitedTT / funnel.plannedTT) * 100,
    },
    {
      title: 'Фото подтверждено',
      value: funnel.photoVerified,
      total: funnel.visitedTT,
      icon: Camera,
      color: 'emerald' as const,
      percentage: (funnel.photoVerified / funnel.visitedTT) * 100,
    },
    {
      title: 'Создан заказ',
      value: funnel.orderCreated,
      total: funnel.photoVerified,
      icon: ShoppingBag,
      color: 'amber' as const,
      percentage: (funnel.orderCreated / funnel.photoVerified) * 100,
    },
    {
      title: 'Выручка',
      value: funnel.revenueGenerated,
      total: funnel.plannedTT,
      icon: DollarSign,
      color: 'rose' as const,
      percentage: (funnel.orderCreated / funnel.plannedTT) * 100,
    },
  ]

  const conversionMetrics = [
    { label: 'Конверсия визитов', value: (funnel.visitedTT / funnel.plannedTT) * 100, color: 'text-blue-600' },
    { label: 'Конверсия заказов', value: (funnel.orderCreated / funnel.visitedTT) * 100, color: 'text-emerald-600' },
    { label: 'Общая конверсия', value: (funnel.orderCreated / funnel.plannedTT) * 100, color: 'text-indigo-600' },
    { label: 'Ср. чек', value: funnel.orderCreated > 0 ? funnel.revenueGenerated / funnel.orderCreated : 0, isCurrency: true },
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Sales Funnel - Воронка продаж</h2>
        <span className="text-sm text-slate-500">Логика конверсии</span>
      </div>

      {/* Funnel Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {steps.map((step, index) => (
          <FunnelStep key={index} {...step} />
        ))}
      </div>

      {/* Conversion Metrics */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Метрики конверсии</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {conversionMetrics.map((metric, index) => (
            <div key={index} className="text-center">
              <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
              <p className={`text-lg font-bold ${metric.isCurrency ? 'text-slate-900' : metric.color}`}>
                {metric.isCurrency
                  ? formatCurrency(metric.value as number)
                  : formatPercent(metric.value as number, 1)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Визуализация воронки</h3>
        <div className="space-y-2">
          {steps.slice(0, -1).map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-24 text-xs text-slate-500">{step.title}</div>
              <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${
                    step.color === 'indigo' ? 'from-indigo-500 to-indigo-600' :
                    step.color === 'blue' ? 'from-blue-500 to-blue-600' :
                    step.color === 'emerald' ? 'from-emerald-500 to-emerald-600' :
                    step.color === 'amber' ? 'from-amber-500 to-amber-600' :
                    'from-rose-500 to-rose-600'
                  } rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
                  style={{ width: `${(step.value / funnel.plannedTT) * 100}%` }}
                >
                  <span className="text-xs font-medium text-white whitespace-nowrap">
                    {formatNumber(step.value)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
