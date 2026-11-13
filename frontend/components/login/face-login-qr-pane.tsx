"use client";

type Props = {
  qrDataUrl: string | null;
  bridgeUrl: string;
  qrPhase: "wait" | "entering" | null;
};

export function FaceLoginQrPane({ qrDataUrl, bridgeUrl, qrPhase }: Props) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-slate-600">
        Отсканируйте QR телефоном. На телефоне пройдите те же повороты головы и отправьте фото.
      </p>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL QR
        <img
          src={qrDataUrl}
          alt="QR Face ID"
          className="mx-auto rounded-xl border border-slate-200"
        />
      ) : (
        <p className="break-all rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700">
          {bridgeUrl || "…"}
        </p>
      )}
      <p className="text-xs text-slate-500">
        {qrPhase === "entering"
          ? "Лицо подтверждено — вход в систему…"
          : "Ожидаем подтверждение с телефона… проверка на сервере. TTL ~2 мин."}
      </p>
      {qrPhase === "entering" ? (
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-600" />
        </div>
      ) : (
        <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-500" />
        </div>
      )}
      {bridgeUrl ? (
        <p className="break-all font-mono text-[10px] text-slate-400">{bridgeUrl}</p>
      ) : null}
      <button
        type="button"
        className="text-sm text-blue-600 hover:underline disabled:opacity-50"
        disabled={!bridgeUrl}
        onClick={() => void navigator.clipboard?.writeText(bridgeUrl)}
      >
        Скопировать ссылку
      </button>
    </div>
  );
}
