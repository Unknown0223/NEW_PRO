/** Klientlar ro‘yxati filtrlari — `GET /clients` query bilan mos (draft / applied). */



import type { ClientSortField } from "@/lib/client-list-sort";

import {

  appendNamedStringListParam,

  appendPositiveIntListParam,

  appendStringListParam,

  singleValueFromUi,

  splitMultiFilterValues,

  uiFromSingleValue

} from "@/lib/client-filter-select-value";



export type ClientToolbarFiltersState = {

  activeFilter: "all" | "true" | "false";

  categoryFilter: string;

  regionFilter: string;

  cityFilter: string;

  districtFilter: string;

  zoneFilter: string;

  clientTypeFilter: string;

  clientFormatFilter: string;

  salesChannelFilter: string;

  agentFilter: string;

  expeditorFilter: string;

  supervisorFilter: string;

  /** Ko‘p kun: `1|3|5` */

  visitWeekdayFilter: string;

  innFilter: string;

  phoneFilter: string;

  pinflFilter: string;

  hasInventoryFilter: "" | "yes" | "no";

  equipmentKindFilter: string;

  creditAllowedFilter: "" | "yes" | "no";

  consignmentFilter: "" | "yes" | "no";

  consignmentLimitedFilter: "" | "yes" | "no";

  locationFilter: "" | "yes" | "no";

  createdFrom: string;

  createdTo: string;

};



export const INITIAL_CLIENT_TOOLBAR_FILTERS: ClientToolbarFiltersState = {

  activeFilter: "true",

  categoryFilter: "",

  regionFilter: "",

  cityFilter: "",

  districtFilter: "",

  zoneFilter: "",

  clientTypeFilter: "",

  clientFormatFilter: "",

  salesChannelFilter: "",

  agentFilter: "",

  expeditorFilter: "",

  supervisorFilter: "",

  visitWeekdayFilter: "",

  innFilter: "",

  phoneFilter: "",

  pinflFilter: "",

  hasInventoryFilter: "",

  equipmentKindFilter: "",

  creditAllowedFilter: "",

  consignmentFilter: "",

  consignmentLimitedFilter: "",

  locationFilter: "",

  createdFrom: "",

  createdTo: ""

};



export type ClientListFilterBundle = ClientToolbarFiltersState & {

  search: string;

  sortField: ClientSortField;

  sortOrder: "asc" | "desc";

};



export function appendClientListFilterParams(params: URLSearchParams, p: ClientListFilterBundle): void {

  if (p.search.trim()) params.set("search", p.search.trim());

  if (p.activeFilter !== "all") params.set("is_active", p.activeFilter);

  appendNamedStringListParam(params, "category", "categories", p.categoryFilter);

  appendNamedStringListParam(params, "region", "regions", p.regionFilter);

  appendNamedStringListParam(params, "city", "cities", p.cityFilter);

  if (p.districtFilter.trim()) params.set("district", p.districtFilter.trim());

  appendNamedStringListParam(params, "client_type_code", "client_type_codes", p.clientTypeFilter);

  appendNamedStringListParam(params, "client_format", "client_formats", p.clientFormatFilter);

  appendNamedStringListParam(params, "sales_channel", "sales_channels", p.salesChannelFilter);

  appendPositiveIntListParam(params, "agent_id", "agent_ids", p.agentFilter);

  appendPositiveIntListParam(params, "expeditor_user_id", "expeditor_user_ids", p.expeditorFilter);

  appendPositiveIntListParam(params, "supervisor_user_id", "supervisor_user_ids", p.supervisorFilter);

  appendPositiveIntListParam(params, "visit_weekday", "visit_weekdays", p.visitWeekdayFilter);

  appendStringListParam(params, "zone", p.zoneFilter);



  if (p.innFilter === "__has__") params.set("has_inn", "true");

  else if (p.innFilter === "__none__") params.set("has_inn", "false");

  else if (p.innFilter.trim()) params.set("inn", p.innFilter.trim());



  if (p.phoneFilter === "__has__") params.set("has_phone", "true");

  else if (p.phoneFilter === "__none__") params.set("has_phone", "false");

  else if (p.phoneFilter.trim()) params.set("phone", p.phoneFilter.trim());



  if (p.pinflFilter.trim()) params.set("client_pinfl", p.pinflFilter.trim());

  if (p.hasInventoryFilter === "yes") params.set("has_active_equipment", "true");

  if (p.hasInventoryFilter === "no") params.set("has_active_equipment", "false");

  appendNamedStringListParam(params, "equipment_kind", "equipment_kinds", p.equipmentKindFilter);

  if (p.creditAllowedFilter === "yes") params.set("has_credit", "true");

  if (p.creditAllowedFilter === "no") params.set("has_credit", "false");

  if (p.consignmentFilter === "yes") params.set("agent_consignment", "yes");

  if (p.consignmentFilter === "no") params.set("agent_consignment", "no");

  if (p.consignmentLimitedFilter === "yes") params.set("agent_consignment_limited", "yes");

  if (p.consignmentLimitedFilter === "no") params.set("agent_consignment_limited", "no");

  if (p.locationFilter === "yes") params.set("has_coords", "true");

  if (p.locationFilter === "no") params.set("missing_coords", "true");

  if (p.createdFrom.trim()) params.set("created_from", p.createdFrom.trim());

  if (p.createdTo.trim()) params.set("created_to", p.createdTo.trim());

  params.set("sort", p.sortField);

  params.set("order", p.sortOrder);

}



/** Panel ↔ state yordamchilari (eksport testlar uchun) */

export { singleValueFromUi, splitMultiFilterValues, uiFromSingleValue };


