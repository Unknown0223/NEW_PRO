import { create } from 'zustand'
import {
  DashboardFilters,
  FinancialKpi,
  VisitKpi,
  ProductCategoryAnalytics,
  DailyVisitRow,
  EfficiencyReport,
  ProductMatrixRow,
  RegionalPerformance,
  SalesFunnelData,
  CategoryTrendData,
  AgentPerformanceData,
  RegionalChartData,
} from '../types/dashboard'
import {
  generateMockFilters,
  generateFinancialKpis,
  generateVisitKpis,
  generateCategoryAnalytics,
  generateDailyVisitReport,
  generateEfficiencyReport,
  generateProductMatrix,
  generateRegionalPerformance,
  generateSalesFunnel,
  generateCategoryTrends,
  generateAgentPerformance,
  generateRegionalChart,
} from '../data/mockData'

interface DashboardState {
  // Filters
  filters: DashboardFilters
  setFilters: (filters: Partial<DashboardFilters>) => void
  resetFilters: () => void

  // Data
  financialKpis: FinancialKpi
  visitKpis: VisitKpi
  categoryAnalytics: ProductCategoryAnalytics[]
  dailyVisitReport: DailyVisitRow[]
  efficiencyReport: EfficiencyReport[]
  productMatrix: ProductMatrixRow[]
  regionalPerformance: RegionalPerformance[]
  salesFunnel: SalesFunnelData
  categoryTrends: CategoryTrendData[]
  agentPerformance: AgentPerformanceData[]
  regionalChart: RegionalChartData[]

  // Loading states
  loading: boolean
  exportLoading: Record<string, boolean>

  // Actions
  loadData: () => Promise<void>
  setExportLoading: (key: string, loading: boolean) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  // Initial state
  filters: generateMockFilters(),
  financialKpis: generateFinancialKpis(),
  visitKpis: generateVisitKpis(),
  categoryAnalytics: generateCategoryAnalytics(),
  dailyVisitReport: generateDailyVisitReport(50),
  efficiencyReport: generateEfficiencyReport(50),
  productMatrix: generateProductMatrix(30),
  regionalPerformance: generateRegionalPerformance(25),
  salesFunnel: generateSalesFunnel(),
  categoryTrends: generateCategoryTrends(30),
  agentPerformance: generateAgentPerformance(20),
  regionalChart: generateRegionalChart(),

  // Loading states
  loading: false,
  exportLoading: {},

  // Filter actions
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }))
  },

  resetFilters: () => {
    set({
      filters: generateMockFilters(),
    })
  },

  // Data loading
  loadData: async () => {
    set({ loading: true })
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    set({
      financialKpis: generateFinancialKpis(),
      visitKpis: generateVisitKpis(),
      categoryAnalytics: generateCategoryAnalytics(),
      dailyVisitReport: generateDailyVisitReport(50),
      efficiencyReport: generateEfficiencyReport(50),
      productMatrix: generateProductMatrix(30),
      regionalPerformance: generateRegionalPerformance(25),
      salesFunnel: generateSalesFunnel(),
      categoryTrends: generateCategoryTrends(30),
      agentPerformance: generateAgentPerformance(20),
      regionalChart: generateRegionalChart(),
      loading: false,
    })
  },

  setExportLoading: (key, loading) => {
    set((state) => ({
      exportLoading: { ...state.exportLoading, [key]: loading },
    }))
  },
}))
