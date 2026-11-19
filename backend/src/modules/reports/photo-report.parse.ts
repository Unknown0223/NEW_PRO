import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type {
  PhotoReportArchive,
  PhotoReportClientActive,
  PhotoReportFilters
} from "./photo-report.types";

export function parsePhotoReportQuery(q: Record<string, string | undefined>): PhotoReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const archRaw = (q.archive ?? "").trim();
  const archive: PhotoReportArchive =
    archRaw === "void" || archRaw === "all" || archRaw === "active" ? archRaw : "active";
  const caRaw = (q.client_active ?? "").trim();
  const client_active: PhotoReportClientActive =
    caRaw === "active" || caRaw === "inactive" ? caRaw : "all";
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    photo_categories: strList(q.photo_categories),
    user_ids: intList(q.user_ids),
    user_roles: strList(q.user_roles),
    client_categories: strList(q.client_categories),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    client_active,
    archive,
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}
