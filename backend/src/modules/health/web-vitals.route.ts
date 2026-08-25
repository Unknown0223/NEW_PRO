import { z } from "zod";
import type { FastifyInstance } from "fastify";
import client from "prom-client";

const webVitalsBodySchema = z.object({
  name: z.enum(["LCP", "CLS", "INP", "FCP", "TTFB"]),
  value: z.number().finite().nonnegative(),
  id: z.string().max(128).optional(),
  path: z.string().max(512).optional()
});

const PATH_ALLOW = new Set([
  "/",
  "/login",
  "/orders",
  "/clients",
  "/dashboard",
  "/payments",
  "/stock",
  "/reports",
  "/settings",
  "/access",
  "/plans",
  "/invoices",
  "/products"
]);

function pathLabel(raw: string | undefined): string {
  const t = (raw ?? "/").trim() || "/";
  const segs = t.split("/").filter(Boolean);
  if (segs.length === 0) return "/";
  const first = `/${segs[0].replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`;
  return PATH_ALLOW.has(first) ? first : "/other";
}

let webVitalsHistogram: client.Histogram<string> | null = null;

function getWebVitalsHistogram(): client.Histogram<string> {
  if (webVitalsHistogram) return webVitalsHistogram;
  const existing = client.register.getSingleMetric("frontend_web_vitals");
  if (existing) {
    webVitalsHistogram = existing as client.Histogram<string>;
    return webVitalsHistogram;
  }
  webVitalsHistogram = new client.Histogram({
    name: "frontend_web_vitals",
    help: "Core Web Vitals reported from Next.js panel",
    labelNames: ["name", "path"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  });
  return webVitalsHistogram;
}

/** Frontend Web Vitals → Prometheus (auth yo‘q; marshrut darajasida rate limit). */
export async function registerWebVitalsRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/metrics/web-vitals",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
    },
    async (request, reply) => {
      const parsed = webVitalsBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({ error: "ValidationError" });
      }
      const path = pathLabel(parsed.data.path);
      getWebVitalsHistogram().observe({ name: parsed.data.name, path }, parsed.data.value);
      return reply.status(204).send();
    }
  );
}
