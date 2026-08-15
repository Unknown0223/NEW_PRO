/** @deprecated — use `@/lib/iana-timezones` (qurilma IANA ro‘yxati). */
export {
  listDeviceIanaTimezones as TENANT_TIMEZONE_LIST,
  toTenantTimezoneOptions,
  type TenantTimezoneOption
} from "@/lib/iana-timezones";

import { listDeviceIanaTimezones, toTenantTimezoneOptions } from "@/lib/iana-timezones";

/** Orqaga moslik: eski static massiv o‘rniga qurilma ro‘yxati. */
export const TENANT_TIMEZONE_OPTIONS = toTenantTimezoneOptions(listDeviceIanaTimezones());
