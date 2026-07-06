import { create } from "zustand";

export interface Filters {
  month: number;
  year: number;
  tradeDirectionId: string | null;
  kpiGroupId: string | null;
  role: string | null;
  status: string | null;
  search: string;
}

interface PlanningState {
  filters: Filters;
  expandedNodes: Set<number>;
  selectedEmployeeId: number | null;
  selectedKpiGroupId: number | null;
  setFilters: (filters: Partial<Filters>) => void;
  toggleNode: (id: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setSelectedEmployeeId: (id: number | null) => void;
  setSelectedKpiGroupId: (id: number | null) => void;
}

export const usePlanningStore = create<PlanningState>((set) => ({
  filters: {
    month: 5,
    year: 2026,
    tradeDirectionId: null,
    kpiGroupId: null,
    role: null,
    status: null,
    search: "",
  },
  expandedNodes: new Set(),
  selectedEmployeeId: null,
  selectedKpiGroupId: null,
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  toggleNode: (id) =>
    set((state) => {
      const next = new Set(state.expandedNodes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedNodes: next };
    }),
  expandAll: () => set({ expandedNodes: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) }),
  collapseAll: () => set({ expandedNodes: new Set() }),
  setSelectedEmployeeId: (id) => set({ selectedEmployeeId: id }),
  setSelectedKpiGroupId: (id) => set({ selectedKpiGroupId: id }),
}));
