"use client";

/**
 * 403 moslashuv wrapper — yangi `ErrorPage` (barcha tizim kodlari) ustida.
 * Sahifa: /forbidden — faqat 403.
 */
import { ErrorPage, type ErrorPageProps } from "@/components/errors/ErrorPage";

export { LockedBrandArt } from "@/components/errors/LockedBrandArt";

export type Forbidden403Props = Omit<
  ErrorPageProps,
  "code" | "resource" | "onRetry" | "onRequestAccess"
> & {
  deniedPage?: string;
  onRefresh?: () => void | Promise<unknown>;
  onRequestAccess?: () => void | Promise<unknown>;
};

export function Forbidden403({
  deniedPage,
  onRefresh,
  onRequestAccess,
  ...props
}: Forbidden403Props) {
  return (
    <ErrorPage
      {...props}
      code={403}
      resource={deniedPage}
      onRetry={
        onRefresh
          ? async () => {
              await onRefresh();
            }
          : undefined
      }
      onRequestAccess={
        onRequestAccess
          ? () => {
              void onRequestAccess();
            }
          : undefined
      }
    />
  );
}
