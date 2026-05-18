import fp from "fastify-plugin";
import { prisma } from "../config/database";
import { sendApiError } from "../lib/api-error";

function requestPath(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/** Ba’zi marshrutlarda global `preHandler` vaqtida `request.params` hali bo‘sh bo‘lishi mumkin — URL dan slug olamiz. */
function tenantSlugFromApiPath(path: string): string | undefined {
  if (!path.startsWith("/api/")) return undefined;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== "api") return undefined;
  const seg = parts[1];
  if (!seg || seg === "auth") return undefined;
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

export const tenantPlugin = fp(async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const path = requestPath(request.url);
    if (path === "/health" || path === "/ready" || path.startsWith("/auth/") || path.startsWith("/api/auth/")) {
      return;
    }

    const slugFromParams = (request.params as { slug?: string } | undefined)?.slug;
    const slugFromHeader = request.headers["x-tenant-slug"];
    const slug =
      slugFromParams?.trim() ||
      tenantSlugFromApiPath(path) ||
      (Array.isArray(slugFromHeader) ? slugFromHeader[0] : slugFromHeader)?.trim();

    if (!slug) {
      return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, is_active: true }
    });

    if (!tenant || !tenant.is_active) {
      return sendApiError(reply, request, 404, "TenantNotFound", undefined, {
        slug,
        hint: "Проверьте slug в URL и в JWT: выполните db:seed или войдите заново с корректным tenant."
      });
    }

    request.tenant = tenant;
  });
});
