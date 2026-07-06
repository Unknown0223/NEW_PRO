const STORAGE_KEY = "salesdoc.initial-setup.progress.v1";

export type InitialSetupProgress = Record<string, "done" | "skipped">;

function storageKey(tenantSlug: string) {
  return `${STORAGE_KEY}:${tenantSlug}`;
}

export function loadInitialSetupProgress(tenantSlug: string | null): InitialSetupProgress {
  if (!tenantSlug || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(tenantSlug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as InitialSetupProgress;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveInitialSetupProgress(tenantSlug: string, progress: InitialSetupProgress) {
  try {
    localStorage.setItem(storageKey(tenantSlug), JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function markStep(
  tenantSlug: string,
  stepId: string,
  status: "done" | "skipped"
): InitialSetupProgress {
  const prev = loadInitialSetupProgress(tenantSlug);
  const next = { ...prev, [stepId]: status };
  saveInitialSetupProgress(tenantSlug, next);
  return next;
}

export function doneStepIds(progress: InitialSetupProgress): Set<string> {
  const out = new Set<string>();
  for (const [id, st] of Object.entries(progress)) {
    if (st === "done" || st === "skipped") out.add(id);
  }
  return out;
}
