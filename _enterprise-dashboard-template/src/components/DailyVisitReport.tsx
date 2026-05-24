import { useMemo, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { formatCurrency, formatNumber, getStatusColor } from '../utils/formatting'
import { Download, ChevronUp, ChevronDown, Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { DailyVisitRow as DailyVisitRowType } from '../types/dashboard'

export default function DailyVisitReport() {
  const data = useDashboardStore((state) => state.dailyVisitReport)
  const exportLoading = useDashboardStore((state) => state.exportLoading)
  const setExportLoading = useDashboardStore((state) => state.setExportLoading)

  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: keyof DailyVisitRowType; direction: 'asc' | 'desc' } | null>(null)

  const filteredData = useMemo(() => {
    let result = [...data]

    if (searchTerm) {
      result = result.filter(
        (row) =>
          row.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.agentId.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] as number
        const bVal = b[sortConfig.key] as number
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        return 0
      })
    }

    return result
  }, [data, searchTerm, sortConfig])

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => ({
        plannedVisited: acc.plannedVisited + row.plannedVisited,
        plannedMissed: acc.plannedMissed + row.plannedMissed,
        unplannedVisited: acc.unplannedVisited + row.unplannedVisited,
        successfulOrders: acc.successfulOrders + row.successfulOrders,
        failedVisits: acc.failedVisits + row.failedVisits,
        photoReports: acc.photoReports + row.photoReports,
        revenue: acc.revenue + row.revenue,
        quantity: acc.quantity + row.quantity,
      }),
      {
        plannedVisited: 0,
        plannedMissed: 0,
        unplannedVisited: 0,
        successfulOrders: 0,
        failedVisits: 0,
        photoReports: 0,
        revenue: 0,
        quantity: 0,
      }
    )
  }, [filteredData])

  const handleSort = (key: keyof DailyVisitRowType) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleExport = () => {
    setExportLoading('dailyVisits', true)
    setTimeout(() => {
      const ws = XLSX.utils.json_to_sheet(
        filteredData.map((row) => ({
          'ID Агента': row.agentId,
          'Агент': row.agentName,
          'План посещений': row.plannedVisited + row.plannedMissed,
          'Посещено по плану': row.plannedVisited,
          'Не посещено по плану': row.plannedMissed,
          'Внеплановые посещения': row.unplannedVisited,
          'Успешные заказы': row.successfulOrders,
          'Без результата': row.failedVisits,
          'Фото отчеты': row.photoReports,
          'Выручка': row.revenue,
          'Количество': row.quantity,
        }))
      )
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Ежедневный отчет')
      XLSX.writeFile(wb, 'daily_visit_report.xlsx')
      setExportLoading('dailyVisits', false)
    }, 500)
  }

  const SortIcon = ({ column }: { column: keyof DailyVisitRowType }) => {
    if (sortConfig?.key !== column) {
      return <span className="text-slate-300">↕</span>
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Ежедневный отчет посещений</h2>
          <button
            onClick={handleExport}
            disabled={exportLoading['dailyVisits']}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportLoading['dailyVisits'] ? 'Экспорт...' : 'Экспорт Excel'}
          </button>
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer hover:bg-slate-100" onClick={() => handleSort('agentId')}>
                <div className="flex items-center gap-1">ID <SortIcon column="agentId" /></div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer hover:bg-slate-100" onClick={() => handleSort('agentName')}>
                <div className="flex items-center gap-1">Агент <SortIcon column="agentName" /></div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer hover:bg-slate-100" onClick={() => handleSort('plannedVisited')}>
                <div className="flex items-center gap-1 justify-end">Посещено <SortIcon column="plannedVisited" /></div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Пропущено</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Внеплановые</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer hover:bg-slate-100" onClick={() => handleSort('successfulOrders')}>
                <div className="flex items-center gap-1 justify-end">Заказы <SortIcon column="successfulOrders" /></div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Без результата</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Фото</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide cursor-pointer hover:bg-slate-100" onClick={() => handleSort('revenue')}>
                <div className="flex items-center gap-1 justify-end">Выручка <SortIcon column="revenue" /></div>
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">Кол-во</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredData.map((row) => {
              const completionRate = row.plannedVisited / (row.plannedVisited + row.plannedMissed) * 100
              return (
                <tr key={row.agentId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-500">{row.agentId}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-slate-900">{row.agentName}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-emerald-600">{formatNumber(row.plannedVisited)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-500">{formatNumber(row.plannedMissed)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-500">{formatNumber(row.unplannedVisited)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium text-blue-600">{formatNumber(row.successfulOrders)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-500">{formatNumber(row.failedVisits)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-600">{formatNumber(row.photoReports)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold ${getStatusColor(completionRate)}`}>
                      {formatCurrency(row.revenue)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-slate-600">{formatNumber(row.quantity)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-sm text-slate-700">ИТОГО</td>
              <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatNumber(totals.plannedVisited)}</td>
              <td className="px-4 py-3 text-right text-sm text-slate-500">{formatNumber(totals.plannedMissed)}</td>
              <td className="px-4 py-3 text-right text-sm text-slate-500">{formatNumber(totals.unplannedVisited)}</td>
              <td className="px-4 py-3 text-right text-sm text-blue-600">{formatNumber(totals.successfulOrders)}</td>
              <td className="px-4 py-3 text-right text-sm text-slate-500">{formatNumber(totals.failedVisits)}</td>
              <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(totals.photoReports)}</td>
              <td className="px-4 py-3 text-right text-sm text-indigo-600">{formatCurrency(totals.revenue)}</td>
              <td className="px-4 py-3 text-right text-sm text-slate-600">{formatNumber(totals.quantity)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
