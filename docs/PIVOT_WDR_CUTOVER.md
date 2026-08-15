# WebDataRocks → Virtual Pivot cutover

## Done in repo

- [x] Virtual builder default at `/reports/builder` / `/reports/builder/pivot`
- [x] Sidebar: no duplicate constructor; WDR archive link removed from Отчёт
- [x] `/reports/builder/wdr` redirects to pivot (use `?keep=1` for archive notice)
- [x] `@webdatarocks/*` removed from `frontend/package.json`
- [x] `transpilePackages` cleaned of webdatarocks
- [x] Legacy `components/reports/wdr/**` excluded from `tsconfig` (source kept for history)

## Staging soak (ops)

- [ ] 1 week virtual-only on staging, no critical pivot bugs
- [ ] Tenant saved WDR JSON reports open via adapter smoke
- [ ] Bundle size / CI green after dependency removal
- [ ] Delete or zip `frontend/components/reports/wdr/**` when soak passes

## Rollback

If needed, restore `@webdatarocks/react-webdatarocks` from git history and re-point `wdr/page.tsx` to the dynamic import of `wdr-report-builder` (historical files under `components/reports/wdr/`).
