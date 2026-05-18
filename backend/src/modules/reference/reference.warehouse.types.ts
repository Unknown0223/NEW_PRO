export type WarehouseTableRow = {
  id: number;
  name: string;
  type: string | null;
  stock_purpose: string;
  code: string | null;
  address: string | null;
  payment_method: string | null;
  van_selling: boolean;
  is_active: boolean;
  breakdown: { role: string; count: number }[];
  user_total: number;
};

/** Kassadagi kabi ombor bog‘lanish rollari + agent ustuni */
export const WAREHOUSE_LINK_ROLES = [
  "agent",
  "cashier",
  "manager",
  "operator",
  "storekeeper",
  "supervisor",
  "expeditor"
] as const;
export type WarehouseLinkRole = (typeof WAREHOUSE_LINK_ROLES)[number];

const ROLE_FOR_WAREHOUSE_LINK: Record<WarehouseLinkRole, string> = {
  agent: "agent",
  cashier: "operator",
  manager: "operator",
  operator: "operator",
  storekeeper: "operator",
  supervisor: "supervisor",
  expeditor: "expeditor"
};
