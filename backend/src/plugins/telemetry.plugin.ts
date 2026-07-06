import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { trace, context, SpanStatusCode, type Span } from "@opentelemetry/api";
import { NodeTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { env } from "../config/env";

let otelEnabled = false;
const tracer = trace.getTracer("salec-backend");

function initOtelProvider(): void {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) return;

  const exporter = new OTLPTraceExporter({ url: endpoint });
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? "salec-backend"
    })
  });
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();
  otelEnabled = true;
}

export function isOtelEnabled(): boolean {
  return otelEnabled;
}

export const telemetryPlugin = fp(async (app) => {
  try {
    initOtelProvider();
  } catch (err) {
    app.log.warn({ err }, "OpenTelemetry init failed — continuing without tracing");
    return;
  }

  if (!otelEnabled) {
    app.log.info("OpenTelemetry disabled — OTEL_EXPORTER_OTLP_ENDPOINT not set");
    return;
  }

  app.log.info({ endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }, "OpenTelemetry initialized");

  app.addHook("onRequest", (request: FastifyRequest, _reply: FastifyReply, done) => {
    const span = tracer.startSpan(`${request.method} ${request.routeOptions?.url ?? request.url}`, {
      attributes: {
        "http.method": request.method,
        "http.url": request.url,
        "http.request_id": request.id
      }
    });
    (request as FastifyRequest & { _otelSpan?: Span })._otelSpan = span;
    context.with(trace.setSpan(context.active(), span), () => done());
  });

  app.addHook("onResponse", (request: FastifyRequest, reply: FastifyReply, done) => {
    const span = (request as FastifyRequest & { _otelSpan?: Span })._otelSpan;
    if (span) {
      span.setAttribute("http.status_code", reply.statusCode);
      if (reply.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    }
    done();
  });
});
