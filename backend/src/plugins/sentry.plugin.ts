import fp from "fastify-plugin";
import * as Sentry from "@sentry/node";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env";

let sentryEnabled = false;

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export const sentryPlugin = fp(async (app) => {
  const dsn = env.SENTRY_DSN?.trim();
  if (!dsn) {
    app.log.info("Sentry disabled — SENTRY_DSN not set");
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0
  });
  sentryEnabled = true;
  app.log.info("Sentry initialized");

  app.addHook("onRequest", (request: FastifyRequest, _reply: FastifyReply, done) => {
    Sentry.getCurrentScope().setTag("request_id", request.id);
    if (request.tenant?.id != null) {
      Sentry.getCurrentScope().setTag("tenant_id", String(request.tenant.id));
    }
    done();
  });

  app.addHook("onError", (request, _reply, error: FastifyError, done) => {
    if (sentryEnabled && (error.statusCode ?? 500) >= 500) {
      Sentry.captureException(error, {
        extra: { requestId: request.id, path: request.url, method: request.method }
      });
    }
    done();
  });
});
