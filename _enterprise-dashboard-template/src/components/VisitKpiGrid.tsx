import { useDashboardStore } from '../store/dashboardStore'
import { formatNumber, formatPercent, getProgressColor, getStatusColor } from '../utils/formatting'
import { MapPin, CheckCircle, Camera, Target, BarChart3 } from 'lucide-react'

const VisitKpiCard = ({
  title,
  value,
  total,
  icon: Icon,
  percentage,
}: {
  title: string
  value: number
  total: number
  icon: React.ElementType
  percentage: number
}) => {
  const progressColor = getProgressColor(percentage)
  const statusColor = getStatusColor(percentage)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{formatNumber(value)}</span>
            <span className="text-sm text-slate-400">/ {formatNumber(total)}</span>
          </div>
        </div>
        <div className="bg-indigo-50 p-2.5 rounded-lg">
          <Icon className="h-5 w-5 text-indigo-600" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${statusColor}`}>
            {formatPercent(percentage)}
          </span>
          <span className="text-xs text-slate-400">Выполнение</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`${progressColor} h-2 rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function VisitKpiGrid() {
  const kpis = useDashboardStore((state) => state.visitKpis)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">KPI Посещений</h2>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <BarChart3 className="h-4 w-4" />
          <span>Аналитика визитов</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VisitKpiCard
          title="Посещения (по визитам)"
          value={kpis.actualVisits}
          total={kpis.plannedVisits}
          icon={MapPin}
          percentage={kpis.completionRate}
        />

        <VisitKpiCard
          title="Успешные визиты"
          value={kpis.successfulVisits}
          total={kpis.actualVisits}
          icon={CheckCircle}
          percentage={(kpis.successfulVisits / kpis.actualVisits) * 100}
        />

        <VisitKpiCard
          title="Посещения (по GPS)"
          value={kpis.gpsVerifiedVisits}
          total={kpis.actualVisits}
          icon={Target}
          percentage={kpis.gpsVerificationRate}
        />

        <VisitKpiCard
          title="Фото отчеты"
          value={kpis.photoReports}
          total={kpis.actualVisits}
          icon={Camera}
          percentage={kpis.photoCoverageRate}
        />
      </div>

      {/* Summary Stats */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">План</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{formatNumber(kpis.plannedVisits)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Факт</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{formatNumber(kpis.actualVisits)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">GPS Проверка</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{formatPercent(kpis.gpsVerificationRate)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Фото покрытие</p>
            <p className="text-xl font-bold text-indigo-600 mt-1">{formatPercent(kpis.photoCoverageRate)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
