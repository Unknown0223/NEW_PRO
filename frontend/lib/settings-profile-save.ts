import { api } from "@/lib/api";

type TenantProfileResponse = {
  references?: Record<string, unknown>;
};

/** Serverdan eng so‘nggi references — eski React Query keshidan emas. */
export async function fetchFreshProfileReferences(tenantSlug: string): Promise<Record<string, unknown>> {
  const { data } = await api.get<TenantProfileResponse>(`/api/${tenantSlug}/settings/profile`, {
    headers: { "Cache-Control": "no-cache" }
  });
  return data.references ?? {};
}

export async function patchProfileReferences(
  tenantSlug: string,
  references: Record<string, unknown>
): Promise<void> {
  await api.patch(`/api/${tenantSlug}/settings/profile`, { references });
}

/**
 * Ro‘yxat elementini serverdagi yangi ro‘yxatga qo‘shadi yoki yangilaydi.
 * Boshqa tab / import / geo-boundaries saqlaganda yo‘qolmasligi uchun avval serverdan o‘qiladi.
 */
export async function saveProfileReferenceArrayItem<T extends { id: string }>(
  tenantSlug: string,
  refKey: string,
  item: T,
  editId: string | null,
  sort?: (rows: T[]) => T[]
): Promise<void> {
  const refs = await fetchFreshProfileReferences(tenantSlug);
  const current = Array.isArray(refs[refKey]) ? ([...refs[refKey]] as T[]) : [];
  const merged = editId ? current.map((x) => (x.id === editId ? item : x)) : [...current, item];
  const next = sort ? sort(merged) : merged;
  await patchProfileReferences(tenantSlug, { [refKey]: next });
}

/** To‘liq ro‘yxatni server holati asosida almashtiradi (masalan, foydalanuvchi bog‘lashlari). */
export async function saveProfileReferenceArrayMerged<T extends { id: string }>(
  tenantSlug: string,
  refKey: string,
  merge: (current: T[]) => T[],
  sort?: (rows: T[]) => T[]
): Promise<void> {
  const refs = await fetchFreshProfileReferences(tenantSlug);
  const current = Array.isArray(refs[refKey]) ? ([...refs[refKey]] as T[]) : [];
  const merged = merge(current);
  const next = sort ? sort(merged) : merged;
  await patchProfileReferences(tenantSlug, { [refKey]: next });
}
