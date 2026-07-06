/** Maksimal JPEG fayl (25 MiB) — telefon kamerasi asl sifati saqlansin. */
export const CLIENT_PHOTO_MAX_BYTES = 25 * 1024 * 1024;

/** Base64 uzunligi (≈33% kattaroq). */
export const CLIENT_PHOTO_MAX_BASE64_LEN = Math.ceil((CLIENT_PHOTO_MAX_BYTES * 4) / 3);

/** `data:image/jpeg;base64,` + base64 */
export const CLIENT_PHOTO_MAX_IMAGE_URL_LEN = 23 + CLIENT_PHOTO_MAX_BASE64_LEN;

/** JSON body (base64 + caption) uchun Fastify bodyLimit zaxirasi. */
export const CLIENT_PHOTO_HTTP_BODY_LIMIT_BYTES = CLIENT_PHOTO_MAX_BASE64_LEN + 512 * 1024;
