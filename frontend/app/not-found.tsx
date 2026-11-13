"use client";

import { HttpStatusScreen } from "@/components/errors/http-status-screen";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-stretch justify-center bg-[#f2f5fa] p-3">
      <HttpStatusScreen code={404} homePath="/dashboard" />
    </div>
  );
}
