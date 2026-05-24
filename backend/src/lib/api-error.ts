import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodError } from "zod";

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

export function sendApiError(
  reply: FastifyReply,
  request: FastifyRequest,
  statusCode: number,
  error: string,
  message?: string,
  extras?: ErrorExtras
) {
  return reply.status(statusCode).send(buildApiError(request, error, message, extras));
}

export function zodValidationExtras(zodError: ZodError): Record<string, unknown> {
  return { details: zodError.flatten() };
}
