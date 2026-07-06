# SALEC mobil ilova — emulyator va ish stoli sozlamalari

Bu hujjat loyihadagi **barcha emulyator / Play Market / mobil dev** ishlari yig‘ilgan qo‘llanma.  
Maqsad: **ishxonadagi kompyuterda** xuddi shu muhitni qayta yaratish.

**Loyiha yo‘li (namuna):** `D:\SALEC — копия`  
**Build yo‘li (majburiy):** `C:\salesdoc_mobile` — kirill yo‘l Gradle/aapt ni buzadi.

---

## 1. Kerakli dasturlar

| Dastur | Tavsiya etilgan yo‘l / versiya |
|--------|--------------------------------|
| **Flutter SDK** | `C:\src\flutter` (stable) |
| **Android Studio** | So‘nggi versiya + Android SDK |
| **Android SDK** | `%LOCALAPPDATA%\Android\Sdk` |
| **JDK** | Android Studio JBR: `C:\Program Files\Android\Android Studio\jbr` |
| **Node.js** | Backend uchun (monorepo root) |
| **Docker** | PostgreSQL (agar `start-dev.cmd` ishlatilsa) |
| **Git** | Ixtiyoriy |

### PATH ga qo‘shiladigan papkalar

```text
C:\src\flutter\bin
C:\Program Files\Android\Android Studio\jbr\bin
%LOCALAPPDATA%\Android\Sdk\platform-tools
%LOCALAPPDATA%\Android\Sdk\emulator
```

Tekshirish:

```powershell
flutter doctor -v
adb version
java -version
```

---

## 2. Nima uchun `C:\salesdoc_mobile`?

Loyiha papkasi kirill harflarida (`SALEC — копия`). Android build vositalari (`aapt`, Gradle) bunday yo‘llarda **xato beradi**.

**Yechim:** kod `mobile\` dan o‘qiladi, lekin build va `flutter run` faqat `C:\salesdoc_mobile` da bajariladi.

`start-mobile.cmd` avtomatik:

1. Birinchi marta — butun `mobile\` ni `C:\salesdoc_mobile` ga nusxalaydi
2. Keyingi safar — faqat `lib\`, `android\`, `pubspec.yaml`, `.env` yangilanadi

Qo‘lda sinxron (zarur bo‘lsa):

```powershell
robocopy "D:\SALEC — копия\mobile\lib" C:\salesdoc_mobile\lib /E /NFL /NDL /NJH /NJS
robocopy "D:\SALEC — копия\mobile\android" C:\salesdoc_mobile\android /E /XD .gradle /NFL /NDL /NJH /NJS
copy /Y "D:\SALEC — копия\mobile\pubspec.yaml" C:\salesdoc_mobile\
copy /Y "D:\SALEC — копия\mobile\.env" C:\salesdoc_mobile\
```

---

## 3. Emulyator (AVD) — tavsiya etilgan model

### Asosiy (tavsiya): `salesdoc_pixel7`

| Parametr | Qiymat |
|----------|--------|
| **Qurilma profili** | Pixel 7 (`pixel_7`) |
| **Tizim rasmi** | `system-images;android-34;google_apis_playstore;x86_64` |
| **Android** | 14 (API 34) |
| **Play Store** | Ha (`google_apis_playstore`) |
| **Page size** | 4 KB (oddiy — **16 KB emas**) |
| **Ekran** | **1080 × 2400** px |
| **Zichlik** | 420 dpi |
| **RAM** | 2048 MB |
| **Disk (data)** | 10 GB |
| **GPU** | yoqilgan (`-gpu host`) |
| **Klaviatura** | `hw.keyboard=yes`, `hw.keyboard.lid=no` |

**Nima uchun Pixel 7, Pixel 9a emas?**  
`Pixel_9a` AVD ko‘pincha **Android 37 + 16 KB page size** (`google_apis_playstore_ps16k`) bilan keladi. SALEC ilovasi ishlaydi, lekin **Play Marketdan ko‘p uchinchi tomon ilovalari o‘rnatilmaydi** (masalan, **Cactus Agent / Кактус Агент**).

### Zaxira AVD lar (skriptlarda)

| Skript alias | AVD nomi | Izoh |
|--------------|----------|------|
| `pixel7` | `salesdoc_pixel7` | **Asosiy — ishlating** |
| `pixel8` | `salesdoc_pixel8` | Ixtiyoriy |
| `pixel9` | `Pixel_9a` | Play Store muammolari bo‘lishi mumkin |
| `tablet` | `salesdoc_tablet` | Ixtiyoriy |

---

## 4. Yangi `salesdoc_pixel7` AVD yaratish (ish stolida bir marta)

### 4.1 Android Studio orqali

1. **Android Studio → Device Manager → Create Device**
2. **Phone → Pixel 7 → Next**
3. **System Image:** tab *Recommended* yoki *x86 Images*
   - Tanlang: **API 34**, **Google Play** (Google APIs Play Store)
   - **16 KB page size** yozuvi bo‘lmasin
4. **AVD Name:** `salesdoc_pixel7`
5. **Finish** → sozlamalar:
   - RAM: **2048 MB**
   - Internal Storage: **10240 MB** (10 GB)
   - Enable Device Frame: yoqilgan

### 4.2 Buyruq qatori orqali

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"

# Tizim rasmini yuklash (SDK Manager)
& "$sdk\cmdline-tools\latest\bin\sdkmanager.bat" "system-images;android-34;google_apis_playstore;x86_64"

# AVD yaratish
echo no | & "$sdk\cmdline-tools\latest\bin\avdmanager.bat" create avd `
  -n salesdoc_pixel7 `
  -k "system-images;android-34;google_apis_playstore;x86_64" `
  -d pixel_7 --force
```

### 4.3 `config.ini` da tekshirish / tuzatish

Fayl: `%USERPROFILE%\.android\avd\salesdoc_pixel7.avd\config.ini`

Muhim qatorlar:

```ini
PlayStore.enabled=true
hw.device.name=pixel_7
hw.lcd.width=1080
hw.lcd.height=2400
hw.lcd.density=420
hw.ramSize=2048
disk.dataPartition.size=10G
hw.gpu.enabled=yes
hw.keyboard=yes
hw.keyboard.lid=no
image.sysdir.1=system-images\android-34\google_apis_playstore\x86_64\
target=android-34
```

**Pixel_9a dan farqi** (muammo bo‘lsa tekshiring):

```ini
# Pixel_9a — ISHLATMANG (Play Market muammosi)
image.sysdir.1=system-images\android-37.0\google_apis_playstore_ps16k\x86_64\
tag.ids=google_apis_playstore,page_size_16kb
```

---

## 5. Emulyatorni ishga tushirish

### Avtomatik (mobil ilova bilan)

```powershell
cd "D:\SALEC — копия"
.\run-mobile.cmd
```

Yoki:

```powershell
cd "D:\SALEC — копия\mobile"
.\start-mobile.cmd
```

Skript ketma-ketligi:

1. `[1/5]` — repo `mobile\` tekshiruvi  
2. `[2/5]` — `C:\salesdoc_mobile` ga nusxa  
3. `[3/5]` — emulyator (avval `salesdoc_pixel7`, yo‘q bo‘lsa `Pixel_9a`)  
4. Klaviatura tuzatish (`fix-emulator-keyboard.ps1`)  
5. `[4/5]` — backend `http://127.0.0.1:18080` tekshiruvi  
6. `[5/5]` — `flutter run` faqat `C:\salesdoc_mobile` da  

### Qo‘lda emulyator

```powershell
cd "D:\SALEC — копия\mobile"
.\start-emulator.cmd pixel7
```

Yoki to‘g‘ridan-to‘g‘ri:

```powershell
emulator -avd salesdoc_pixel7 -no-snapshot-load -gpu host
adb wait-for-device
```

**`-no-snapshot-load`** — cold boot; klaviatura va Play Store sozlamalari yangilanishidan keyin foydali.

Emulyator ro‘yxati:

```powershell
flutter emulators
emulator -list-avds
adb devices
```

---

## 6. Backend va tarmoq

| Muhit | Backend manzil |
|-------|----------------|
| Kompyuter brauzeri | `http://127.0.0.1:18080` |
| Android emulyator | `http://10.0.2.2:18080` (avtomatik almashtiriladi) |
| Veb panel | `http://127.0.0.1:3000` |

### Backend ishga tushirish

Tez rejim (monorepo root):

```powershell
cd "D:\SALEC — копия"
.\start-dev-quick.cmd
```

Yoki backend papkada:

```powershell
cd "D:\SALEC — копия\backend"
npm run dev
```

`start-mobile.cmd` ichida `ensure-backend-dev.ps1` eski backendni (404) to‘xtatib, yangisini ochadi.

### Test login (agent)

| Maydon | Qiymat |
|--------|--------|
| Slug (tenant) | `test1` |
| Login | `agent` |
| Parol | `111111` |

Import agent (alternativa): `demo_agent_sample` / `Parol123!`

### `adb reverse` (ixtiyoriy)

Ba’zi holatlarda foydali:

```powershell
adb reverse tcp:18080 tcp:18080
```

Asosan emulyator `10.0.2.2` orqali hostga ulanadi — alohida reverse shart emas.

---

## 7. `mobile\.env` sozlamalari

**Muhim:** Flutter faqat `mobile\.env` ni o‘qiydi, repo root `.env` emas!

Namuna (`mobile\.env.example` dan nusxa oling):

```env
API_BASE_URL=http://127.0.0.1:18080

# Yandex xarita — kalitsiz rejim (tavsiya dev uchun)
YANDEX_MAPS_NO_API_KEY=1

# Yoki JavaScript API kaliti (Static API kaliti ISHLAMAYDI!)
# YANDEX_MAPS_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

`.env` o‘zgarganda:

1. `mobile\.env` ni saqlang  
2. `run-mobile.cmd` yoki `start-mobile.cmd` ni qayta ishga tushiring (nusxa `C:\salesdoc_mobile` ga tushadi)  
3. Flutter terminalida **`R`** (hot restart)

---

## 8. Fizik klaviatura (PC klaviaturasi)

### Muammo

Emulyator oynasida login parol yozib bo‘lmaydi — faqat ekran klaviaturasi ishlaydi yoki umuman yozilmaydi.

### Sabab

AVD da `hw.keyboard=no` yoki `hw.keyboard.lid=yes` (klaviatura «yopiq»).

### Avtomatik tuzatish

Har `start-mobile.cmd` ishga tushganda:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\SALEC — копия\mobile\scripts\fix-emulator-keyboard.ps1"
```

Skript:

- `%USERPROFILE%\.android\avd\salesdoc_pixel7.avd\config.ini` va `hardware-qemu.ini` da klaviaturani yoqadi  
- `adb shell settings put secure show_ime_with_hard_keyboard 0`  

### Qo‘lda (eski usul)

```powershell
cd "D:\SALEC — копия\mobile"
.\fix-emulator-keyboard.cmd
```

### Hali ishlamasa

1. Emulyator oynasiga bir marta bosing (fokus)  
2. Cold boot:

```powershell
adb emu kill
emulator -avd salesdoc_pixel7 -no-snapshot-load -gpu host
```

---

## 9. Play Market — muammolar va yechimlar

### 9.1 «Не удалось установить приложение» (Cactus Agent va boshqalar)

**Asosiy sabab — noto‘g‘ri AVD (16 KB):**

- `Pixel_9a` + `google_apis_playstore_ps16k` → ko‘p APK lar mos kelmaydi  
- **Yechim:** `salesdoc_pixel7` (API 34, oddiy Play Store) ga o‘ting

**Tekshirish:**

```powershell
adb shell getprop ro.build.fingerprint
adb shell pm list packages com.android.vending
adb shell pm list packages com.google.android.gms
```

Kutilgan: `com.android.vending` (Play Store) va `com.google.android.gms` (Google Play Services) mavjud.

### 9.2 HTTP 500 / split APK yuklab olish xatosi

Play Market ba’zan emulyatorda **HTTP 500** qaytaradi (split APK yuklash).

**Yechimlar (ketma-ketlik):**

1. Play Store keshini tozalash:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\SALEC — копия\mobile\scripts\fix-emulator-playstore.ps1"
```

2. Play Market → **Settings → Network preferences → App download preference = Over any network**
3. Google akkauntga qayta kiring (kesh tozalangandan keyin)
4. Bir necha daqiqa kutib, **Install** ni qayta bosing
5. **Aurora Store** orqali o‘rnating (skript avtomatik yuklaydi)

### 9.3 Aurora Store (zaxira)

Skript F-Droid dan Aurora Store o‘rnatadi va Cactus Agent sahifasini ochadi:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\SALEC — копия\mobile\scripts\fix-emulator-playstore.ps1"
```

Aurora Store → qidiruv: **Cactus Agent** yoki paket `com.cactus.system.agent`

### 9.4 Cactus Agent (Кактус Агент)

| Parametr | Qiymat |
|----------|--------|
| Paket nomi | `com.cactus.system.agent` |
| Play Market | [market://details?id=com.cactus.system.agent](market://details?id=com.cactus.system.agent) |

ADB orqali ochish:

```powershell
adb shell am start -a android.intent.action.VIEW -d "market://details?id=com.cactus.system.agent"
adb shell am start -a android.intent.action.VIEW -d "https://play.google.com/store/apps/details?id=com.cactus.system.agent" com.aurora.store
```

**Eslatma:** Play Marketdan to‘g‘ridan-to‘g‘ri o‘rnatish ba’zan muvaffaqiyatsiz — Aurora Store yoki `salesdoc_pixel7` AVD ishlating.

### 9.5 Google akkaunt

Emulyatorda Play Market ishlashi uchun **Google akkaunt** ulangan bo‘lishi kerak:

**Settings → Accounts → Add account → Google**

---

## 10. Yandex xarita (mobil ilova ichida)

Xarita WebView orqali Yandex JS API ishlatadi.

| Muammo | Sabab | Yechim |
|--------|-------|--------|
| Xarita ochilmaydi / timeout | Noto‘g‘ri `.env` joyi | `mobile\.env` ishlating |
| `apikeyValid: false` | **Static API** kaliti | JS API kaliti yoki `YANDEX_MAPS_NO_API_KEY=1` |
| Chiziq ko‘rinmaydi | Marshrut yuklanmagan / MultiRoute kech | Hot restart `R`; internetni tekshiring |
| Juda sekin (EGL 60s+) | Emulyator grafikasi | Normal — real qurilmada tezroq |

Dev uchun tavsiya:

```env
YANDEX_MAPS_NO_API_KEY=1
```

Haqiqiy kalit kerak bo‘lsa — Yandex Developer kabinetida **«JavaScript API and HTTP Geocoder»** turidagi kalit oling (Static API emas).

---

## 11. Kundalik ish tartibi (ish stoli)

### Birinchi marta (to‘liq o‘rnatish)

1. Flutter, Android Studio, SDK o‘rnating  
2. `salesdoc_pixel7` AVD yarating (4-qism)  
3. Repo ni nusxalang / oching  
4. `mobile\.env` yarating (`copy .env.example .env`)  
5. Backend: `start-dev-quick.cmd` yoki `backend\npm run dev`  
6. `run-mobile.cmd`  
7. Emulyatorda Google akkaunt qo‘shing  
8. Play Market muammosi bo‘lsa: `fix-emulator-playstore.ps1`  
9. Login: `test1` / `agent` / `111111`

### Har kuni

```powershell
cd "D:\SALEC — копия"
.\run-mobile.cmd
```

Yoki backend allaqachon ishlayotgan bo‘lsa — faqat mobil:

```powershell
cd "D:\SALEC — копия\mobile"
.\start-mobile.cmd
```

### Kod o‘zgarganda

| O‘zgarish | Harakat |
|-----------|---------|
| Dart (`lib\`) | Terminalda **`R`** (hot restart) |
| `.env`, `pubspec.yaml`, native | `run-mobile.cmd` qayta |
| Backend API | Backend oynasini qayta ishga tushiring; mobil **`R`** |

---

## 12. Tez-tez uchraydigan xatolar

### «AVD topilmadi»

Android Studio → Device Manager → `salesdoc_pixel7` yarating (4-qism).

### Gradle / aapt kirill yo‘l xatosi

Build faqat `C:\salesdoc_mobile` da. `start-mobile.cmd` ishlating.

### Sinxronizatsiya 67% da qotib qoladi

SQLite sxema eski (`visit_weekdays` ustuni yo‘q).  
**Yechim:** ilovani o‘chirib qayta o‘rnating yoki app data tozalang; yangi kod DB migratsiyasini qo‘llaydi.

### Login qayta ochiladi (401)

Backend ishlamayapti yoki eski versiya. `ensure-backend-dev.ps1` yoki `npm run dev` qayta ishga tushiring.

### Emulyator juda sekin

- `-gpu host` ishlating  
- RAM 2048 MB  
- Keraksiz AVD larni yoping  
- Cold boot: `-no-snapshot-load`

### `adb` qurilma ko‘rinmaydi

```powershell
adb kill-server
adb start-server
adb devices
```

---

## 13. Foydali buyruqlar (qisqa)

```powershell
# Emulyator holati
adb devices -l
adb shell getprop ro.product.model

# Ilovani o‘chirish (toza o‘rnatish)
adb uninstall uz.salesdoc.salesdoc_mobile

# Log (xato qidirish)
adb logcat -d | Select-String -Pattern "flutter|salesdoc|Finsky|INSTALL"

# Emulyatorni yopish
adb emu kill

# Flutter qurilmalar
flutter devices

# Faqat build papkada run
cd C:\salesdoc_mobile
flutter pub get
flutter run -d emulator-5554
```

---

## 14. Loyihadagi skriptlar (xarita)

| Fayl | Vazifa |
|------|--------|
| `run-mobile.cmd` | Repo root → `mobile\start-mobile.cmd` |
| `mobile\start-mobile.cmd` | Nusxa, emulyator, backend, `flutter run` |
| `mobile\start-emulator.cmd` | Faqat emulyator (`pixel7` / `pixel8` / `pixel9` / `tablet`) |
| `mobile\scripts\fix-emulator-keyboard.ps1` | Fizik klaviatura |
| `mobile\scripts\fix-emulator-playstore.ps1` | Play Market kesh, Aurora Store, Cactus Agent |
| `mobile\scripts\ensure-backend-dev.ps1` | Backend 18080 tekshiruvi |
| `mobile\fix-emulator-keyboard.cmd` | Klaviatura (qo‘lda, eski) |
| `start-dev-quick.cmd` | Frontend + backend tez rejim |

---

## 15. Ish stolida nusxa olish checklist

- [ ] Flutter `C:\src\flutter`, `flutter doctor` yashil/yellow acceptable  
- [ ] Android SDK + emulator + platform-tools  
- [ ] JDK (Android Studio JBR)  
- [ ] AVD **`salesdoc_pixel7`**: API 34, Google Play, 1080×2400, 2 GB RAM, 10 GB disk  
- [ ] **`C:\salesdoc_mobile`** papkasi mavjud (skript yaratadi)  
- [ ] **`mobile\.env`**: `API_BASE_URL`, `YANDEX_MAPS_NO_API_KEY=1`  
- [ ] Backend `18080` da ishlaydi  
- [ ] Emulyatorda Google akkaunt  
- [ ] `run-mobile.cmd` → login `test1` / `agent` / `111111`  
- [ ] Play Market muammosi → `fix-emulator-playstore.ps1`  
- [ ] Klaviatura → `fix-emulator-keyboard.ps1` + cold boot  

---

## 16. Qisqa xulosa

| Savol | Javob |
|-------|-------|
| Qaysi emulyator? | **`salesdoc_pixel7`** (Pixel 7, Android 14, Play Store) |
| Ekran o‘lchami? | **1080 × 2400**, 420 dpi |
| Qayerda build? | **`C:\salesdoc_mobile`** (kirill yo‘l emas) |
| Qanday ishga tushirish? | **`run-mobile.cmd`** |
| Play Market ishlamayapti? | 16 KB AVD dan qoching; kesh tozalang; Aurora Store |
| Cactus Agent? | `com.cactus.system.agent`, Aurora yoki `salesdoc_pixel7` |
| Backend? | `127.0.0.1:18080`, emulyator `10.0.2.2:18080` |
| Xarita? | `mobile\.env`, `YANDEX_MAPS_NO_API_KEY=1` |

---

*Oxirgi yangilanish: 2026-06-07 — loyiha dev muhiti va emulyator sozlamalari bo‘yicha.*
