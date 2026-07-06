export type SourceTab = "expeditor" | "collector" | "van" | "bank";
export type DealType = "regular" | "consignment" | "both";
export type StatusFilter = "pending_confirmation" | "confirmed" | "rejected" | "";

export type EprFilterState = {
  tab: SourceTab;
  dealType: DealType;
  dateFrom: string;
  dateTo: string;
  status: StatusFilter;
  expeditorIds: number[];
  agentIds: number[];
  paymentType: string;
  tradeDirection: string;
  territoryZone: string;
  territoryRegion: string;
  territoryCity: string;
  territoryDistrict: string;
  search: string;
};

export function monthUtc(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` };
}

export function defaultEprFilters(): EprFilterState {
  const { from, to } = monthUtc();
  return {
    tab: "expeditor",
    dealType: "both",
    dateFrom: from,
    dateTo: to,
    status: "",
    expeditorIds: [],
    agentIds: [],
    paymentType: "",
    tradeDirection: "",
    territoryZone: "",
    territoryRegion: "",
    territoryCity: "",
    territoryDistrict: "",
    search: ""
  };
}
