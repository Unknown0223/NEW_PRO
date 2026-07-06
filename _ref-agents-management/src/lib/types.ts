export interface Agent {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string;
  fullname: string;
  code: string;
  phone: string;
  email: string;
  pinfl: string;
  agentType: string;
  productCount: number;
  consignation: boolean;
  apkVersion: string;
  deviceName: string;
  lastSync: string | null;
  login: string;
  priceTypes: string[];
  products: string[];
  warehouse: string;
  tradeDirection: string;
  branch: string;
  position: string;
  appAccess: boolean;
  active: boolean;
  maxSessions: number;
  kpiColor: string;
  createdAt: string;
  activeSessions: number;
}

export interface AgentSession {
  id: number;
  agentId: number;
  device: string;
  ip: string;
  os: string;
  appInfo: string;
  createdAt: string;
}

export interface AgentListResponse {
  data: Agent[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
