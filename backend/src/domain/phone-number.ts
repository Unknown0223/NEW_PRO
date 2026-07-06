/** Telefon raqami — normalizatsiya qilingan string. */
export type PhoneNumber = string & { readonly __brand: "PhoneNumber" };

const PHONE_DIGITS_RE = /\D/g;

/** Raqamli qismlarni saqlab, bo'shliqlarni olib tashlaydi. */
export function normalizePhoneNumber(raw: string): PhoneNumber {
  const digits = raw.replace(PHONE_DIGITS_RE, "").trim();
  return digits as PhoneNumber;
}

export function isValidPhoneNumber(raw: string): boolean {
  const digits = raw.replace(PHONE_DIGITS_RE, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function phoneNumberToDisplay(p: PhoneNumber): string {
  return p;
}
