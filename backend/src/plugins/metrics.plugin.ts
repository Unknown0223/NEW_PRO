import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import client from "prom-client";
import { env } from "../config/env";

function getHttpRequestDurationHistogram(): client.Histogram<string> {
  const existing = client.register.getSingleMetric("http_request_duration_seconds");
  if (existing) {
    return existing as client.Histogram<string>;
  }
  return new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  });
}

function getHttpRequestsTotalCounter(): client.Counter<string> {
  const existing = client.register.getSingleMetric("http_requests_total");
  if (existing) {
    return existing as client.Counter<string>;
  }
  return new client.Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status_code"]
  });
}

let defaultMetricsEnabled = false;

function ensureDefaultMetrics(): void {
  if (defaultMetricsEnabled || client.register.getSingleMetric("process_cpu_user_seconds_total")) {
    defaultMetricsEnabled = true;
    return;
  }
  client.collectDefaultMetrics({ register: client.register });
  defaultMetricsEnabled = true;
}

function routeLabel(request: FastifyRequest): string {
  const configured = request.routeOptions?.url;
  if (configured) return configured;
  const q = request.url.indexOf("?");
  return q === -1 ? request.url : request.url.slice(0, q);
}

function metricsAuthorized(request: FastifyRequest): boolean {
  if (env.NODE_ENV !== "production") return true;
  const expectedToken = env.INTERNAL_HEALTH_TOKEN?.trim();
  if (!expectedToken) return false;
  const provided = request.headers["x-internal-token"];
  const token = Array.isArray(provided) ? provided[0] : provided;
  return token === expectedToken;
}

export const metricsPlugin = fp(async (app) => {
  ensureDefaultMetrics();

  const httpRequestDurationSeconds = getHttpRequestDurationHistogram();
  const httpRequestsTotal = getHttpRequestsTotalCounter();

  app.addHook("onResponse", (request: FastifyRequest, reply: FastifyReply, done) => {
    const labels = {
      method: request.method,
      route: routeLabel(request),
      status_code: String(reply.statusCode)
    };
    const seconds = reply.elapsedTime / 1000;
    httpRequestDurationSeconds.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
    done();
  });

  app.get("/metrics", async (request, reply) => {
    if (!metricsAuthorized(request)) {
      return reply.status(env.NODE_ENV === "production" ? 401 : 404).send({ error: "Unauthorized" });
    }
    reply.header("Content-Type", client.register.contentType);
    return reply.send(await client.register.metrics());
  });
});
