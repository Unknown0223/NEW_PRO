Bu papkadagi fayllar:

| Fayl | Vazifa |
|------|--------|
| `skeleton.yaml` | Marshrutlar (paths) — qo‘lda yangilanadi |
| `generated/components.json` | Zod → JSON Schema (`npm run openapi:generate`) |
| `openapi.bundle.yaml` | skeleton + generated schemas — CI `openapi:lint` |

```bash
npm run openapi:generate   # contracts/*.schemas.ts dan
npm run openapi:lint       # skeleton + bundle validate
```

Batafsil: `docs/openapi-strategy.md`.
