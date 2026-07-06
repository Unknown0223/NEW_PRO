import type { Prisma } from "@prisma/client";
import type { ListClientsQuery } from "./clients.types";

export function clientListOrderBy(
  sortField: NonNullable<ListClientsQuery["sort"]>,
  ord: Prisma.SortOrder
): Prisma.ClientOrderByWithRelationInput {
  switch (sortField) {
    case "phone":
      return { phone: ord };
    case "id":
      return { id: ord };
    case "created_at":
      return { created_at: ord };
    case "region":
      return { region: ord };
    case "legal_name":
      return { legal_name: ord };
    case "address":
      return { address: ord };
    case "responsible_person":
      return { responsible_person: ord };
    case "landmark":
      return { landmark: ord };
    case "inn":
      return { inn: ord };
    case "client_pinfl":
      return { client_pinfl: ord };
    case "sales_channel":
      return { sales_channel: ord };
    case "category":
      return { category: ord };
    case "client_type_code":
      return { client_type_code: ord };
    case "client_format":
      return { client_format: ord };
    case "district":
      return { district: ord };
    case "neighborhood":
      return { neighborhood: ord };
    case "zone":
      return { zone: ord };
    case "city":
      return { city: ord };
    case "client_code":
      return { client_code: ord };
    case "latitude":
      return { latitude: ord };
    case "longitude":
      return { longitude: ord };
    case "name":
    default:
      return { name: ord };
  }
}
