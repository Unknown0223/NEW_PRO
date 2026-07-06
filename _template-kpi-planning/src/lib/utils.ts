import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0 UZS";
  return new Intl.NumberFormat("ru-RU").format(num) + " UZS";
}

export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("ru-RU").format(num);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "in_progress":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "pending_approval":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "rejected":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "archived":
      return "bg-gray-100 text-gray-500 border-gray-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "draft": return "Черновик";
    case "in_progress": return "В процессе";
    case "pending_approval": return "На согласовании";
    case "approved": return "Одобрено";
    case "rejected": return "Возвращено для редактирования";
    case "archived": return "Архив";
    default: return status;
  }
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case "director": return "Директор";
    case "sales_director": return "Директор по продажам";
    case "commercial_director": return "Коммерческий директор";
    case "manager": return "Менеджер";
    case "supervisor": return "Супервайзер";
    case "agent": return "Агент";
    default: return role;
  }
}
