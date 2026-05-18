"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";

export interface OrderItem {
  id: string;
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  total: number;
  is_bonus: boolean;
}

interface OrderCreateState {
  clientId: number | null;
  clientName: string | null;
  warehouseId: number | null;
  items: OrderItem[];
  total: number;
  discount: number;
  bonusSum: number;
  orderType: string;
  notes: string;
  isSubmitting: boolean;
  errors: string[];
}

type OrderCreateAction =
  | { type: "SET_CLIENT"; payload: { clientId: number; clientName: string } }
  | { type: "SET_WAREHOUSE"; payload: number }
  | { type: "ADD_ITEM"; payload: OrderItem }
  | { type: "UPDATE_ITEM"; payload: { id: string; qty: number; price: number } }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "CLEAR_ITEMS" }
  | { type: "SET_ORDER_TYPE"; payload: string }
  | { type: "SET_NOTES"; payload: string }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_ERRORS"; payload: string[] }
  | { type: "RESET" };

function calculateTotal(items: OrderItem[]): { total: number; bonusSum: number } {
  let total = 0;
  let bonusSum = 0;
  for (const item of items) {
    if (item.is_bonus) {
      bonusSum += item.total;
    } else {
      total += item.total;
    }
  }
  return { total, bonusSum };
}

function orderReducer(state: OrderCreateState, action: OrderCreateAction): OrderCreateState {
  switch (action.type) {
    case "SET_CLIENT":
      return { ...state, clientId: action.payload.clientId, clientName: action.payload.clientName };

    case "SET_WAREHOUSE":
      return { ...state, warehouseId: action.payload };

    case "ADD_ITEM": {
      const exists = state.items.find((i) => i.product_id === action.payload.product_id && !i.is_bonus);
      if (exists) {
        const newItems = state.items.map((i) =>
          i.id === exists.id
            ? { ...i, qty: i.qty + action.payload.qty, total: (i.qty + action.payload.qty) * i.price }
            : i
        );
        const { total, bonusSum } = calculateTotal(newItems);
        return { ...state, items: newItems, total, bonusSum };
      }
      const newItems = [...state.items, action.payload];
      const { total, bonusSum } = calculateTotal(newItems);
      return { ...state, items: newItems, total, bonusSum };
    }

    case "UPDATE_ITEM": {
      const newItems = state.items.map((i) =>
        i.id === action.payload.id
          ? { ...i, qty: action.payload.qty, price: action.payload.price, total: action.payload.qty * action.payload.price }
          : i
      );
      const { total, bonusSum } = calculateTotal(newItems);
      return { ...state, items: newItems, total, bonusSum };
    }

    case "REMOVE_ITEM": {
      const newItems = state.items.filter((i) => i.id !== action.payload);
      const { total, bonusSum } = calculateTotal(newItems);
      return { ...state, items: newItems, total, bonusSum };
    }

    case "CLEAR_ITEMS":
      return { ...state, items: [], total: 0, bonusSum: 0 };

    case "SET_ORDER_TYPE":
      return { ...state, orderType: action.payload };

    case "SET_NOTES":
      return { ...state, notes: action.payload };

    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.payload };

    case "SET_ERRORS":
      return { ...state, errors: action.payload };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

const initialState: OrderCreateState = {
  clientId: null,
  clientName: null,
  warehouseId: null,
  items: [],
  total: 0,
  discount: 0,
  bonusSum: 0,
  orderType: "order",
  notes: "",
  isSubmitting: false,
  errors: []
};

interface OrderCreateContextValue {
  state: OrderCreateState;
  dispatch: React.Dispatch<OrderCreateAction>;
  setClient: (clientId: number, clientName: string) => void;
  setWarehouse: (warehouseId: number) => void;
  addItem: (item: OrderItem) => void;
  updateItem: (id: string, qty: number, price: number) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  setOrderType: (type: string) => void;
  setNotes: (notes: string) => void;
  reset: () => void;
}

const OrderCreateContext = createContext<OrderCreateContextValue | null>(null);

export function OrderCreateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(orderReducer, initialState);

  const setClient = (clientId: number, clientName: string) => {
    dispatch({ type: "SET_CLIENT", payload: { clientId, clientName } });
  };

  const setWarehouse = (warehouseId: number) => {
    dispatch({ type: "SET_WAREHOUSE", payload: warehouseId });
  };

  const addItem = (item: OrderItem) => {
    dispatch({ type: "ADD_ITEM", payload: item });
  };

  const updateItem = (id: string, qty: number, price: number) => {
    dispatch({ type: "UPDATE_ITEM", payload: { id, qty, price } });
  };

  const removeItem = (id: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: id });
  };

  const clearItems = () => {
    dispatch({ type: "CLEAR_ITEMS" });
  };

  const setOrderType = (type: string) => {
    dispatch({ type: "SET_ORDER_TYPE", payload: type });
  };

  const setNotes = (notes: string) => {
    dispatch({ type: "SET_NOTES", payload: notes });
  };

  const reset = () => {
    dispatch({ type: "RESET" });
  };

  return (
    <OrderCreateContext.Provider
      value={{
        state,
        dispatch,
        setClient,
        setWarehouse,
        addItem,
        updateItem,
        removeItem,
        clearItems,
        setOrderType,
        setNotes,
        reset
      }}
    >
      {children}
    </OrderCreateContext.Provider>
  );
}

export function useOrderCreate() {
  const context = useContext(OrderCreateContext);
  if (!context) {
    throw new Error("useOrderCreate must be used within OrderCreateProvider");
  }
  return context;
}