/**
 * HTTP `Content-Disposition` — Node faqat ASCII `filename=` qabul qiladi.
 * Kirill nomlar uchun RFC 5987 `filename*=UTF-8''…` qo‘shiladi.
 */
export function attachmentContentDisposition(filename: string): string {
  const fallback = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/\\/g, "_")
    .replace(/"/g, "'");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
