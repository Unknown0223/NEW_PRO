"use client";

/**
 * Ishchi ErrorPage — router amallari bilan (studio yo‘q).
 */
import { useRouter } from "next/navigation";
import { ErrorPage, type ErrorPageProps } from "@/components/errors/ErrorPage";
import type { ErrorCode } from "@/components/errors/error-data";

type Props = Omit<ErrorPageProps, "code" | "onLogin" | "onHome" | "onBack" | "loginHref" | "homeHref"> & {
  code: ErrorCode;
  /** Orqaga o‘rniga boshqa manzil (masalan /settings). */
  homePath?: string;
};

export function HttpStatusScreen({
  code,
  homePath = "/dashboard",
  onRetry,
  ...rest
}: Props) {
  const router = useRouter();

  return (
    <div className="flex min-h-[70vh] w-full flex-1 items-stretch justify-center">
      <ErrorPage
        {...rest}
        code={code}
        homeHref={homePath}
        loginHref="/login"
        onLogin={() => router.push("/login")}
        onHome={() => router.push(homePath)}
        onBack={() => {
          if (typeof window !== "undefined" && window.history.length > 1) router.back();
          else router.push(homePath);
        }}
        onRetry={
          onRetry ??
          (async () => {
            router.refresh();
          })
        }
      />
    </div>
  );
}
