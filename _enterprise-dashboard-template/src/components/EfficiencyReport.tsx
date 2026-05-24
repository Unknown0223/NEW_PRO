import { useMemo, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { formatCurrency, formatNumber, formatPercent, getStatusColor } from '../utils/formatting'
import { Download, Search, TrendingUp, XCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function EfficiencyReport() {
  const data = useDashboardStore((state) => state.efficiencyReport)
  const exportLoading = useDashboardStore((state) => state.exportLoading)
  const setExportLoading = useDashboardStore((state) => state.setExportLoading)

  const [searchTerm, setSearchTerm] = useState('')

  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    return data.filter(
      (row) =>
        row.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.agentId.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  const averages = useMemo(() => {
    const count = filteredData.length
    if (count === 0) return { completion: 0, conversion: 0, avgSales: 0 }
    return {
      completion: filteredData.reduce((sum, r) => sum + r.visitCompletionRate, 0) / count,
      conversion: filteredData.reduce((sum, r) => sum + r.orderConversionRate, 0) / count,
      avgSales: filteredData.reduce((sum, r) => sum + r.totalSales, 0) / count,
    }
  }, [filteredData])

  const handleExport = () => {
    setExportLoading('efficiency', true)
    setTimeout(() => {
      const ws = XLSX.utils.json_to_sheet(
        filteredData.map((row) => ({
          'ID Агента': row.agentId,
          'Агент': row.agentName,
          'Сумма заказов': row.totalSales,
          'Заказы': row.orders,
          'Отмененные': row.canceled,
          'Визиты (План)': row.plannedVisits,
          'Отказы': row.refusals,
          'Непосещенные': row.missedVisits,
          'Посещенные %': row.visitCompletionRate,
          'Конверсия %': row.orderConversionRate,
          'Фотоотчеты': row.photoReports,
        }))
      )
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Эффективность')
      XLSX.writeFile(wb, 'efficiency_report.xlsx')
      setExportLoading('efficiency', false)
    }, 500)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Отчет эффективности</h2>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading['efficiency']}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportLoading['efficiency'] ? 'Экспорт...' : 'Экспорт Excel'}
          </button>
        </div>

        {/* Average Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            <p className="text-xs text-emerald-600 font-medium uppercase">Ср. выполнение</p>
            <p className="text-xl font-bold text-emerald-700">{formatPercent(averages.completion)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-blue-600 font-medium uppercase">Ср. конверсия</p>
            <p className="text-xl font-bold text-blue-700">{formatPercent(averages.conversion)}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
            <p className="text-xs text-indigo-600 font-medium uppercase">Ср. выручка</p>
            <p className="text-xl font-bold text-indigo-700">{formatCurrency(averages.avgSales)}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по агенту..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto max-h-96">
        <table className="w-full">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">Агент</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Сумма</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Заказы</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Отмены</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">План</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Отказы</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Пропущено</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Выполнение</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Конверсия</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Фото</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredData.map((row) => (
              <tr key={row.agentId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-500">{row.agentId}</td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-slate-900">{row.agentName}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.totalSales)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-medium text-blue-600">{formatNumber(row.orders)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <XCircle className="h-3 w-3 text-red-400" />
                    <span className="text-sm text-slate-500">{row.canceled}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-600">{formatNumber(row.plannedVisits)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-500">{formatNumber(row.refusals)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-500">{formatNumber(row.missedVisits)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`${getStatusColor(row.visitCompletionRate).replace('text-', 'bg-')} h-1.5 rounded-full`}
                        style={{ width: `${row.visitCompletionRate}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${getStatusColor(row.visitCompletionRate)}`}>
                      {formatPercent(row.visitCompletionRate, 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`${getStatusColor(row.orderConversionRate).replace('text-', 'bg-')} h-1.5 rounded-full`}
                        style={{ width: `${row.orderConversionRate}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${getStatusColor(row.orderConversionRate)}`}>
                      {formatPercent(row.orderConversionRate, 0)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-slate-600">{formatNumber(row.photoReports)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
