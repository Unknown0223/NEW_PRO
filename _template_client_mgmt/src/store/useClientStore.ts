import { create } from 'zustand';

interface ClientsState {
  filters: Record<string, any>;
  search: string;
  selectedRows: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  setFilters: (filters: Record<string, any>) => void;
  setSearch: (search: string) => void;
  setSelectedRows: (ids: string[]) => void;
  setPagination: (pagination: Partial<ClientsState['pagination']>) => void;
  resetFilters: () => void;
}

export const useClientStore = create<ClientsState>((set) => ({
  filters: {},
  search: '',
  selectedRows: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 413851,
  },
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setSearch: (search) => set({ search }),
  setSelectedRows: (ids) => set({ selectedRows: ids }),
  setPagination: (pagination) =>
    set((state) => ({ pagination: { ...state.pagination, ...pagination } })),
  resetFilters: () => set({ filters: {} }),
}));
