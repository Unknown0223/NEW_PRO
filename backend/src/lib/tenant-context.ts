import type { FastifyReply, FastifyRequest } from "fastify";
import { sendApiError } from "./api-error";
import { getAccessUser } from "../modules/auth/auth.prehandlers";

export function ensureTenantContext(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!request.tenant) {
    void sendApiError(reply, request, 404, "TenantNotFound");
    return false;
  }
  const jwtUser = getAccessUser(request);
  if (Number(jwtUser.tenantId) !== request.tenant.id) {
    void sendApiError(reply, request, 403, "CrossTenantDenied");
    return false;
  }
  return true;
}
