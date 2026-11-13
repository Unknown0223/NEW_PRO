"use client";

/**
 * Sahifa yuklashdagi 401/403/404/429/5xx — to‘liq ErrorPage.
 * Toast o‘rniga: asosiy query yiqilganda children o‘rniga shu komponent.
 */
import { HttpStatusScreen } from "@/components/errors/http-status-screen";
import {
  errorCodeFromUnknown,
  retryAfterFromUnknown,
  supportRefFromUnknown
} from "@/lib/http-status-from-error";

type Props = {
  error: unknown;
  resource?: string;
  onRetry?: () => void | Promise<unknown>;
  homePath?: string;
};

export function PageLoadHttpError({ error, resource, onRetry, homePath }: Props) {
  const code = errorCodeFromUnknown(error) ?? 500;
  return (
    <HttpStatusScreen
      code={code}
      resource={resource}
      retryAfter={retryAfterFromUnknown(error)}
      referenceId={supportRefFromUnknown(error)}
      homePath={homePath}
      onRetry={
        onRetry
          ? async () => {
              await onRetry();
            }
          : undefined
      }
    />
  );
}
