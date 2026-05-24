export const STOCK_PURPOSE_VALUES = ["sales", "return", "reserve"] as const;

export const warehouseDetailSelect = {
  id: true,
  name: true,
  type: true,
  stock_purpose: true,
  code: true,
  address: true,
  payment_method: true,
  van_selling: true,
  is_active: true,
  links: {
    select: {
      link_role: true,
      user: { select: { id: true, name: true, login: true } }
    }
  }
} as const;
