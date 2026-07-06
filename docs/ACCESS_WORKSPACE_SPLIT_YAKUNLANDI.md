# ✅ Access workspace split — yakunlandi

**Sana:** 2026-06-26

## Maqsad

`access-workspace.tsx` (~2870 qator) — max-loc 400 dan oshgan monolit. To‘liq modullarga bo‘lingan, har bir fayl ≤400 LOC.

## Tekshiruv

```powershell
cd frontend
npm run access:verify
```

| Qadam | Natija |
|-------|--------|
| `typecheck` | ✅ |
| `tests/access-workspace-split.test.ts` | ✅ 3/3 |
| `audit:max-loc` | ✅ |

## Modul tuzilmasi

| Fayl | Vazifa |
|------|--------|
| `access-workspace.tsx` | Orchestrator (~thin) |
| `access-workspace.shared.ts` | Umumiy tiplar va helperlar |
| `access-workspace.shared-ui.tsx` | UI fragmentlar |
| `use-access-workspace.part1.ts` … `part5.ts` | Hook qatlamlari |
| `use-access-workspace.ts` | Hook compose |
| `access-workspace-left-panel.tsx` | Chap panel |
| `access-workspace-operations-panel.tsx` | Operatsiyalar tab |
| `access-workspace-operations-dim-table.tsx` | Operatsiya jadvali |
| `access-workspace-scope-panel.tsx` | Kassa/ombor/filial tablari |
| `access-workspace-user-picker-modal.tsx` | Foydalanuvchi tanlash |

## Bog‘liq modullar (avvaldan)

| Fayl | Vazifa |
|------|--------|
| `access-user-detail-panel.tsx` | Foydalanuvchi kartasi |
| `access-bulk-bottom-bar.tsx` | Bulk amallar |
| `access-role-defaults-workspace.tsx` | Rol defaultlari |
