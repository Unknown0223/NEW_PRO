import { useMemo } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { formatCurrency } from '../utils/formatting'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4', '#84cc16']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-900 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.payload.sales ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function ChartsSection() {
  const categoryTrends = useDashboardStore((state) => state.categoryTrends)
  const agentPerformance = useDashboardStore((state) => state.agentPerformance)
  const regionalChart = useDashboardStore((state) => state.regionalChart)
  const categoryAnalytics = useDashboardStore((state) => state.categoryAnalytics)

  // Prepare trend data by category
  const trendData = useMemo(() => {
    const categories = Array.from(new Set(categoryTrends.map((d) => d.category)))
    const dates = Array.from(new Set(categoryTrends.map((d) => d.date))).slice(-14)

    return dates.map((date) => {
      const entry: any = { date }
      categories.forEach((cat) => {
        const dataPoint = categoryTrends.find((d) => d.date === date && d.category === cat)
        entry[cat] = dataPoint?.sales || 0
      })
      return entry
    })
  }, [categoryTrends])

  // Prepare pie chart data
  const pieData = useMemo(() => {
    return categoryAnalytics.slice(0, 6).map((item) => ({
      name: item.category,
      value: item.salesAmount,
    }))
  }, [categoryAnalytics])

  // Regional data for bar chart
  const regionalData = useMemo(() => {
    return regionalChart.map((item) => ({
      region: item.region,
      sales: item.sales,
      visits: item.visits,
    }))
  }, [regionalChart])

  // Agent performance data
  const agentData = useMemo(() => {
    return agentPerformance.slice(0, 10).map((item) => ({
      agent: item.agent,
      sales: item.sales,
      conversion: item.conversion,
    }))
  }, [agentPerformance])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Визуальная аналитика</h2>
      </div>

      {/* Category Trends - Area Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Динамика продаж по категориям (14 дней)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                {['Молочные продукты', 'Напитки', 'Бакалея', 'Кондитерские изделия'].map((_, i) => (
                  <linearGradient key={i} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="Молочные продукты" stroke={COLORS[0]} fillOpacity={1} fill="url(#color0)" />
              <Area type="monotone" dataKey="Напитки" stroke={COLORS[1]} fillOpacity={1} fill="url(#color1)" />
              <Area type="monotone" dataKey="Бакалея" stroke={COLORS[2]} fillOpacity={1} fill="url(#color2)" />
              <Area type="monotone" dataKey="Кондитерские изделия" stroke={COLORS[3]} fillOpacity={1} fill="url(#color3)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regional Performance - Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Региональная производительность</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip
                  content={<CustomTooltip />}
                  formatter={(value: any) => [formatCurrency(value), 'Продажи']}
                />
                <Legend />
                <Bar dataKey="sales" name="Продажи" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="visits" name="Посещения" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Share - Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Доля категорий в продажах</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Performance - Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Топ агентов по выручке</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agentData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <YAxis dataKey="agent" type="category" tick={{ fontSize: 12 }} width={80} />
              <Tooltip
                content={<CustomTooltip />}
                formatter={(value: any) => [formatCurrency(value), 'Выручка']}
              />
              <Bar dataKey="sales" name="Выручка" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
