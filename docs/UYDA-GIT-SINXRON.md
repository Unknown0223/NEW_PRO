# Uyda GitHub dan yangilash (mobil bilan)

**Maqsad:** uy kompyuterida `git pull` qilganda monorepo **va** `mobile/` Flutter ilovasi birga keladi.

**Repo:** https://github.com/Unknown0223/NEW_PRO  
**Asosiy branch (default):** `main` — unda backend, frontend, **mobile**, skills, deepen hujjatlari bor.

## Bir martalik (yangi kompyuter)

```powershell
git clone https://github.com/Unknown0223/NEW_PRO.git
cd NEW_PRO
git checkout main
git pull

# Mobil muhit
cd mobile
copy .env.example .env
# .env ichida API_BASE_URL=http://127.0.0.1:18080 (yoki prod URL)
flutter pub get
```

Flutter SDK PATH da bo‘lishi kerak. Keyin ildizdan:

```powershell
.\uyda-yangilash.cmd
# yoki faqat mobil:
.\run-mobile.cmd
```

## Har safar yangilash (tavsiya)

Ildizda:

```powershell
.\uyda-yangilash.cmd
```

Skript:

1. `git fetch` + joriy branchga `git pull` (odatda `main`)
2. `mobile/` papkasini tekshiradi
3. `.env` yo‘q bo‘lsa `.env.example` dan nusxa oladi
4. `flutter pub get` ishlatadi

Qo‘lda:

```powershell
git checkout main
git pull origin main
cd mobile
if (!(Test-Path .env)) { copy .env.example .env }
flutter pub get
```

## Nima GitHub da, nima lokal

| Keladi (git) | Kelmaydi (gitignore / maxfiy) |
|--------------|-------------------------------|
| `mobile/lib`, `pubspec.yaml`, testlar | `mobile/.env`, `.env.local` |
| `mobile/android` manba | `android/local.properties`, `key.properties`, `*.jks` |
| `mobile/releases/README.txt` | `mobile/releases/*.apk`, `dist/` |
| `.agents/skills`, `skills-lock.json` | `node_modules`, `build/`, `.dart_tool/` |

APK ni gitga qo‘ymaymiz — uyda `flutter build apk` yoki `mobile\build-apk-local.cmd`.

## Branch eslatma

- Kundalik ish / uy sinxroni: **`main`**
- Agar faqat redesign feature kerak bo‘lsa: `git checkout feature/mobile-ui-redesign && git pull`

## Reja holati (qayerdamiz)

| Yo‘nalish | Holat | Hujjat |
|-----------|--------|--------|
| Agent mobil 9.1–9.3 | ✅ | `mobile/AGENT_REJA_HOLATI.md` |
| Mobil UI redesign | ✅ ekranlar; `main` da | `mobile/REDESIGN_STATUS.md` |
| Architecture deepen M1 (#1–4) | ✅ | `docs/architecture/DEEPENING-PLAN-PROGRESS.md` |
| Skills (9 ta, mattpocock) | ✅ `.agents/skills` | shu progress fayl |

## Tekshiruv

```powershell
# mobil papka borligi
Test-Path mobile\pubspec.yaml

# Flutter
cd mobile
flutter doctor
flutter test
```
