import { z } from "zod";
import type { FastifyInstance } from "fastify";
import client from "prom-client";

const webVitalsBodySchema = z.object({
  name: z.enum(["LCP", "CLS", "INP", "FCP", "TTFB"]),
  value: z.number().finite().nonnegative(),
  id: z.string().max(128).optional(),
  path: z.string().max(512).optional()
});

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

/** Frontend Web Vitals → Prometheus (auth talab qilinmaydi, rate limit global). */
export async function registerWebVitalsRoutes(app: FastifyInstance) {
  app.post("/api/:slug/metrics/web-vitals", async (request, reply) => {
    const parsed = webVitalsBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: "ValidationError" });
    }
    const path = parsed.data.path?.trim() || "/";
    getWebVitalsHistogram().observe({ name: parsed.data.name, path }, parsed.data.value);
    return reply.status(204).send();
  });
}
