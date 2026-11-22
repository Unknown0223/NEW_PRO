import { useCallback, useRef, useState } from "react";
import type { DirectionContext } from "@salec/plans-proposal";
import { initialConfigs, initialVisibleKpiIds } from "@taklifiy/lib/draft-config";
import { AUDIT_ACTOR, makeAuditEntries, type AuditChange, type AuditEntry } from "@taklifiy/lib/audit";
import {
  MAX_AUDIT,
  MAX_DRAFTS,
  createSharedDraft,
  draftKey,
  readSharedDrafts,
  writeSharedDrafts,
  type SharedDraft,
  type StorageState
} from "@taklifiy/lib/storage";

export type SharedDraftApi = {
  drafts: SharedDraft[];
  active: SharedDraft | null;
  activeKey: string | null;
  audit: AuditEntry[];
  error: string | null;
  /** Avtomatik saqlash: patch + ixtiyoriy audit o‘zgartirishlari. */
  patch: (patch: Partial<SharedDraft>, changes?: AuditChange[]) => void;
  /** Davr/yo‘nalish almashganda shu kalit uchun yagona draftni yuklaydi yoki yaratadi. */
  activate: (context: DirectionContext) => SharedDraft;
  importDraft: (draft: SharedDraft) => SharedDraft;
  resetActive: (context: DirectionContext) => SharedDraft;
  clearError: () => void;
};

function bootstrap(): StorageState {
  // Production: bo‘sh holatda demo draft yozilmaydi — faqat saqlangan draftlar.
  // Birinchi haqiqiy context `activate()` orqali keladi.
  return readSharedDrafts();
}

/** Bitta umumiy draft + audit jurnali uchun yagona saqlash qatlami. */
export function useSharedDraft(): SharedDraftApi {
  const [initial] = useState(bootstrap);
  const [drafts, setDrafts] = useState<SharedDraft[]>(initial.drafts);
  const [activeKey, setActiveKey] = useState<string | null>(
    initial.activeKey ?? initial.drafts[0]?.key ?? null
  );
  const [error, setError] = useState<string | null>(initial.error);
  const draftsRef = useRef(drafts);
  const activeKeyRef = useRef(activeKey);

  const persist = useCallback((next: SharedDraft[], key?: string | null) => {
    draftsRef.current = next;
    setDrafts(next);
    if (key !== undefined) {
      activeKeyRef.current = key;
      setActiveKey(key);
    }
    try {
      writeSharedDrafts(next, key === undefined ? activeKeyRef.current : key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Umumiy draftni saqlab bo‘lmadi");
    }
  }, []);

  const patch = useCallback(
    (values: Partial<SharedDraft>, changes: AuditChange[] = []) => {
      const key = activeKeyRef.current;
      if (!key) return;
      const at = new Date().toISOString();
      const entries = changes.length ? makeAuditEntries(changes, key, { at }) : [];
      const next = draftsRef.current.map((d) =>
        d.key === key
          ? {
              ...d,
              ...values,
              savedAt: at,
              updatedBy: AUDIT_ACTOR,
              audit: [...(values.audit ?? d.audit), ...entries].slice(-MAX_AUDIT)
            }
          : d
      );
      persist(next);
    },
    [persist]
  );

  const activate = useCallback(
    (context: DirectionContext): SharedDraft => {
      const key = draftKey(context);
      const existing = draftsRef.current.find((d) => d.key === key);
      if (existing) {
        const next = draftsRef.current.map((d) =>
          d.key === key
            ? { ...d, context: JSON.parse(JSON.stringify(context)) as DirectionContext }
            : d
        );
        persist(next, key);
        return { ...existing, context };
      }
      const created = createSharedDraft(
        context,
        initialConfigs(context.directionId),
        initialVisibleKpiIds(context.directionId)
      );
      const next = [created, ...draftsRef.current].slice(0, MAX_DRAFTS);
      persist(next, key);
      return created;
    },
    [persist]
  );

  const resetActive = useCallback(
    (context: DirectionContext): SharedDraft => {
      const key = draftKey(context);
      const next = draftsRef.current.filter((d) => d.key !== key);
      const created = createSharedDraft(
        context,
        initialConfigs(context.directionId),
        initialVisibleKpiIds(context.directionId)
      );
      persist([created, ...next].slice(0, MAX_DRAFTS), key);
      return created;
    },
    [persist]
  );

  const importDraft = useCallback(
    (draft: SharedDraft): SharedDraft => {
      const at = new Date().toISOString();
      const entry = makeAuditEntries(
        [
          {
            action: "import",
            kpiGroupId: null,
            cellKey: null,
            employeeName: null,
            field: "JSON import",
            before: draft.name,
            after: draft.name,
            summary: `«${draft.name}» JSON fayldan umumiy draftga yuklandi`
          }
        ],
        draft.key,
        { at }
      )[0]!;
      const imported: SharedDraft = {
        ...draft,
        key: draft.key || draftKey(draft.context),
        savedAt: at,
        updatedBy: AUDIT_ACTOR,
        audit: [...draft.audit, entry].slice(-MAX_AUDIT)
      };
      const next = [imported, ...draftsRef.current.filter((d) => d.key !== imported.key)].slice(
        0,
        MAX_DRAFTS
      );
      persist(next, imported.key);
      return imported;
    },
    [persist]
  );

  const active =
    (activeKey ? drafts.find((d) => d.key === activeKey) : undefined) ?? drafts[0] ?? null;
  return {
    drafts,
    active,
    activeKey: active?.key ?? null,
    audit: active?.audit ?? [],
    error,
    patch,
    activate,
    importDraft,
    resetActive,
    clearError: () => setError(null)
  };
}
