/** Login / staff / mobil — yagona pastki chegara (audit P1-4). */
export const PASSWORD_MIN_LEN = 8;

export type PasswordPolicyError = "TOO_SHORT" | "TOO_WEAK";

export function passwordPolicyError(password: string): PasswordPolicyError | null {
  if (password.length < PASSWORD_MIN_LEN) return "TOO_SHORT";
  const hasLetter = /[A-Za-zА-Яа-яЁё]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) return "TOO_WEAK";
  return null;
}

export function isPasswordAllowed(password: string): boolean {
  return passwordPolicyError(password) == null;
}

export function assertPasswordPolicy(password: string): void {
  if (!isPasswordAllowed(password)) throw new Error("BAD_PASSWORD");
}
