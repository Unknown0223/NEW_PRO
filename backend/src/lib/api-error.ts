import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodError } from "zod";
import {
  appendErrorEventSafe,
  inferErrorModule,
  shouldPersistBackendError
} from "./error-event";
import { actorUserIdOrNull } from "./request-actor";

type ErrorExtras = Record<string, unknown> | undefined;

type ErrorPayload = {
  error: string;
  requestId: string;
  message?: string;
} & Record<string, unknown>;

export function buildApiError(
  request: FastifyRequest,
  error: string,
  message?: string,
  extras?: ErrorExtras
): ErrorPayload {
  const payload: ErrorPayload = {
    error,
    requestId: request.id
  };
  if (message) payload.message = message;
  if (extras) Object.assign(payload, extras);
  return payload;
}

function requestPath(request: FastifyRequest): string {
  const raw = request.url?.split("?")[0] ?? "";
  return raw.slice(0, 255);
}

function maybeLogBackendError(
  request: FastifyRequest,
  statusCode: number,
  error: string,
  message?: string
): void {
  const path = requestPath(request);
  if (!shouldPersistBackendError(statusCode, path)) return;
  const tenantId = request.tenant?.id;
  if (tenantId == null || tenantId < 1) return;

  appendErrorEventSafe({
    tenantId,
    userId: actorUserIdOrNull(request),
    source: "backend",
    severity: statusCode >= 500 ? "fatal" : "error",
    requestId: request.id,
    httpStatus: statusCode,
    errorCode: error,
    message: message?.trim() || error,
    path,
    method: request.method,
    platform: "server",
    module: inferErrorModule(path)
  });
}

export function sendApiError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  error: string,
  message?: string,
  extras?: ErrorExtras
) {
  maybeLogBackendError(request, statusCode, error, message);
  return reply.status(statusCode).send(buildApiError(request, error, message, extras));
}

export function zodValidationExtras(zodError: ZodError): Record<string, unknown> {
  const issues = zodError.issues.slice(0, 12).map((i) => ({
    path: i.path.join("."),
    message: i.message
  }));
  return {
    details: {
      ...zodError.flatten(),
      issues
    }
  };
}

/** Qisqa, foydalanuvchiga tushunarli validation xabari */
export function zodValidationSummary(zodError: ZodError, fallback = "Request validation failed"): string {
  const parts = zodError.issues.slice(0, 4).map((i) => {
    const path = i.path.filter((p) => typeof p === "string" || typeof p === "number").join(".");
    const leaf = i.path.length ? String(i.path[i.path.length - 1]) : "";
    if (leaf === "payment_method_id") {
      return "Способ оплаты обязателен для каждого типа цены";
    }
    if (path) return `${path}: ${i.message}`;
    return i.message;
  });
  const joined = parts.filter(Boolean).join("; ");
  return joined || fallback;
}
