/**
 * Force-priority favicon links in <head> for Yandex Browser + Chromium.
 * Yandex prefers classic ICO at a stable path and often ignores SVG.
 * Use a NEW ICO path (favicon-sa.ico) so sticky host:port caches refetch.
 */
import { FAVICON_CACHE_BUST } from "@/lib/favicon-version";

export function FaviconHeadLinks() {
  const v = FAVICON_CACHE_BUST;
  const ico = `/favicon-sa.ico?v=${v}`;
  const png32 = `/icon_32.png?v=${v}`;
  return (
    <>
      {/* Yandex / classic first — shortcut + x-icon (do not lead with SVG) */}
      <link rel="shortcut icon" href={ico} type="image/x-icon" />
      <link rel="icon" href={ico} sizes="any" type="image/x-icon" />
      <link rel="icon" href={png32} type="image/png" sizes="32x32" />
      {/* SVG supplemental only — Chrome may use it; Yandex often ignores */}
      <link rel="icon" href={`/sa-favicon.svg?v=${v}`} type="image/svg+xml" sizes="any" />
      <link rel="apple-touch-icon" href={`/apple-touch-icon.png?v=${v}`} sizes="180x180" />
    </>
  );
}
