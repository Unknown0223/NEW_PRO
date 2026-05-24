import { Icon } from "../Icon";
import {
  AGENTS,
  WAREHOUSES,
  TRADE_DIRECTIONS,
  DISCOUNT_TYPES,
} from "../../data/mock";
import { useRefundStore } from "../../store/refundStore";

interface SelectProps {
  label: string;
  required?: boolean;
  value: number | null;
  onChange: (v: number | null) => void;
  options: { id: number; name: string }[];
  placeholder?: string;
  icon?: "calendar" | "user" | "archive" | "truck" | "target";
}

function SelectField({ label, required, value, onChange, options, placeholder, icon }: SelectProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <Icon
            name={icon}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
        )}
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className={`w-full appearance-none rounded-lg border border-slate-300 bg-white py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 ${
            icon ? "pl-9 pr-9" : "pl-3 pr-9"
          }`}
        >
          <option value="">{placeholder ?? "— выберите —"}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  );
}

export default function OrderInfoCard() {
  const {
    orderDate, setOrderDate,
    agentId, setAgent,
    warehouseId, setWarehouse,
    directionId, setDirection,
    discountId, setDiscount,
  } = useRefundStore();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
          <Icon name="file-text" className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">
          Параметры возврата
        </h2>
        <span className="ml-auto text-xs text-slate-500">Шаг 2 из 5</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600">
            Дата заказа <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Icon
              name="calendar"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              type="datetime-local"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <SelectField
          label="Агент"
          icon="user"
          value={agentId}
          onChange={setAgent}
          options={AGENTS}
          placeholder="Выберите агента"
        />
        <SelectField
          label="Склад для возврата"
          required
          icon="archive"
          value={warehouseId}
          onChange={setWarehouse}
          options={WAREHOUSES}
          placeholder="Выберите склад"
        />
        <SelectField
          label="Направление торговли"
          icon="truck"
          value={directionId}
          onChange={setDirection}
          options={TRADE_DIRECTIONS}
          placeholder="Выберите направление"
        />
        <SelectField
          label="Тип скидки"
          icon="target"
          value={discountId}
          onChange={setDiscount}
          options={DISCOUNT_TYPES}
          placeholder="Без скидки"
        />
      </div>
    </div>
  );
}
