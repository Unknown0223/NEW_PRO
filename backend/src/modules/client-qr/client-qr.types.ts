import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

export type QrListQuery = {
  page: number;
  limit: number;
  search?: string;
  /** Bir nechta status: OR (IN) */
  statuses?: string[];
  /** Eski: bitta status */
  status?: "new" | "printed" | "attached" | "detached";
  /** yes = client_id bor, no = bo‘sh QR */
  attached?: "yes" | "no";
  date_type: "created_date" | "attached_date";
  from?: string;
  to?: string;
  zone?: string;
  region?: string;
  city?: string;
};

export type QrListRow = {
  id: number;
  qr_code: string;
  status: string;
  created_at: string;
  printed_at: string | null;
  bound_at: string | null;
  detached_at: string | null;
  client_id: number | null;
  client_name: string | null;
  zone: string | null;
  region: string | null;
  city: string | null;
  created_by_name: string | null;
  bound_by_name: string | null;
};

export type ClientQrStats = {
  total_qr: number;
  attached_qr: number;
  free_qr: number;
  status_new: number;
  status_printed: number;
  status_attached: number;
  status_detached: number;
  clients_without_qr: number;
};

export type ClientWithoutQrRow = {
  id: number;
  name: string;
  zone: string | null;
  region: string | null;
  city: string | null;
  phone: string | null;
  agent_id: number | null;
};
