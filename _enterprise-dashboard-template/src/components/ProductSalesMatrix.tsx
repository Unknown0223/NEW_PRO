import { useMemo, useState } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { formatCurrency, formatNumber } from '../utils/formatting'
import { Download, Search, Package } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ProductSalesMatrix() {
  const data = useDashboardStore((state) => state.productMatrix)
  const exportLoading = useDashboardStore((state) => state.exportLoading)
  const setExportLoading = useDashboardStore((state) => state.setExportLoading)

  const [searchTerm, setSearchTerm] = useState('')

  const categories = useMemo(() => {
    const allCategories = new Set<string>()
    data.forEach((row) => {
      Object.keys(row.categories).forEach((cat) => allCategories.add(cat))
    })
    return Array.from(allCategories)
  }, [data])

  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    return data.filter(
      (row) =>
        row.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.agentId.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  const columnTotals = useMemo(() => {
    const totals: { [key: string]: number } = {}
    filteredData.forEach((row) => {
      Object.entries(row.categories).forEach(([cat, value]) => {
        totals[cat] = (totals[cat] || 0) + value
      })
    })
    return totals
  }, [filteredData])

  const grandTotal = useMemo(() => {
    return filteredData.reduce((sum, row) => sum + row.total, 0)
  }, [filteredData])

  const handleExport = () => {
    setExportLoading('matrix', true)
    setTimeout(() => {
      const matrixData = filteredData.map((row) => {
        const rowData: { [key: string]: string | number } = {
          'Агент': row.agent,
          'ID': row.agentId,
        }
        categories.forEach((cat) => {
          rowData[cat] = row.categories[cat] || 0
        })
        rowData['Итого'] = row.total
        return rowData
      })

      // Add totals row
      const totalsRow: { [key: string]: string | number } = {
        'Агент': 'ИТОГО',
        'ID': '',
      }
      categories.forEach((cat) => {
        totalsRow[cat] = columnTotals[cat] || 0
      })
      totalsRow['Итого'] = grandTotal
      matrixData.push(totalsRow)

      const ws = XLSX.utils.json_to_sheet(matrixData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Матрица продаж')
      XLSX.writeFile(wb, 'product_sales_matrix.xlsx')
      setExportLoading('matrix', false)
    }, 500)
  }

  const getHeatmapColor = (value: number, max: number) => {
    const intensity = value / max
    if (intensity > 0.8) return 'bg-emerald-100'
    if (intensity > 0.6) return 'bg-emerald-50'
    if (intensity > 0.4) return 'bg-blue-50'
    if (intensity > 0.2) return 'bg-slate-50'
    return 'bg-white'
  }

  const maxCategoryValue = useMemo(() => {
    let max = 0
    filteredData.forEach((row) => {
      Object.values(row.categories).forEach((v) => {
        if (v > max) max = v
      })
    })
    return max
  }, [filteredData])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Матрица продаж по категориям</h2>
          </div>
          <button
            onClick={handleExport}
            disabled={exportLoading['matrix']}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportLoading['matrix'] ? 'Экспорт...' : 'Экспорт Excel'}
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                Агент
              </th>
              {categories.map((category) => (
                <th key={category} className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[100px]">
                  {category}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wide bg-indigo-50">
                ИТОГО
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredData.map((row) => (
              <tr key={row.agentId} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {row.agent.split(' ')[0][0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{row.agent}</p>
                      <p className="text-xs text-slate-400">{row.agentId}</p>
                    </div>
                  </div>
                </td>
                {categories.map((category) => {
                  const value = row.categories[category] || 0
                  const heatClass = getHeatmapColor(value, maxCategoryValue)
                  return (
                    <td key={category} className={`px-3 py-3 text-center ${heatClass}`}>
                      <span className="text-xs font-medium text-slate-700">
                        {formatNumber(value)}
                      </span>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-right font-semibold text-indigo-600 bg-indigo-50">
                  {formatCurrency(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-semibold">
            <tr>
              <td className="px-4 py-3 text-sm text-slate-700 sticky left-0 bg-slate-100 border-r border-slate-200">
                ИТОГО
              </td>
              {categories.map((category) => (
                <td key={category} className="px-3 py-3 text-center text-sm text-slate-700">
                  {formatNumber(columnTotals[category] || 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right text-sm text-indigo-700 bg-indigo-100">
                {formatCurrency(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
