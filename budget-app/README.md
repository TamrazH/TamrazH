# Büdcə — şəxsi büdcə idarəetmə tətbiqi

Azərbaycan dilində, mobil-first (iPhone 14 Pro — 393×852 pt üçün optimallaşdırılıb), offline-first PWA.
Next.js 15 (App Router) · TypeScript strict · Tailwind CSS · Zod · Vitest.
Məlumat cihazda (localStorage) saxlanılır; istəyə görə Google Sheets ilə sinxron olunur.

## Qovluq strukturu

```
src/
  app/            səhifələr (/, /transactions, /add, /accounts, /analytics, /settings) və API route-lar
    api/sheets/   status + sync (server-side Google Sheets)
  components/     UI komponentləri
  hooks/          useStore (state + saxlama + sinxron), useToast, useFilters, ...
  lib/            balans, valyuta, validation, filtr, analitika, merge (təmiz funksiyalar)
    sheets/       Google Sheets: auth (JWT), http (retry/backoff), mapping, sync
  services/       Repository (localStorage; backend-ə keçid üçün interfeys), sync-client
  types/          domen tipləri
tests/            unit testlər
```

## 1. Local quraşdırma

```bash
cd budget-app
npm install
cp .env.example .env.local     # Sheets istifadə etmirsinizsə, boş qala bilər
npm run dev                    # http://localhost:3000
npm test                       # unit testlər
npm run typecheck && npm run lint && npm run build
```

iPhone-da sınamaq üçün: eyni Wi-Fi-da `http://<kompüter-IP>:3000` açın. PWA kimi quraşdırmaq üçün (HTTPS lazımdır — Vercel deploy-dan sonra) Safari → Paylaş → “Ana ekrana əlavə et”.

## 2. Google Cloud layihəsi və Sheets API

1. https://console.cloud.google.com → **New Project** (məs. `budget-app`).
2. **APIs & Services → Library → “Google Sheets API” → Enable**.

## 3. Service account yaratma

1. **IAM & Admin → Service Accounts → Create service account** (ad: `budget-sync`). Rol vermək lazım deyil.
2. Yaranan hesabı açın → **Keys → Add key → Create new key → JSON**. Fayl endirilir.
3. Bu faylı **repoya qoymayın** (`.gitignore` `service-account*.json`, `*credentials*.json`, `.env*` fayllarını bloklayır). Yalnız Vercel/`.env.local`-a köçürün.

## 4. Spreadsheet-i service account-a paylaşma

1. Google Sheets-də yeni boş cədvəl yaradın.
2. **Share** → service account e-poçtunu (`...@...iam.gserviceaccount.com`, JSON-dakı `client_email`) əlavə edin, rol: **Editor**.
3. Spreadsheet ID — URL-dəki `https://docs.google.com/spreadsheets/d/<BU_HİSSƏ>/edit`.

`Transactions`, `Accounts`, `Categories` vərəqləri ilk sinxronda avtomatik yaradılır.

## 5. Environment variables

| Dəyişən | Təsvir |
|---|---|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Cədvəl ID-si |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON faylının bütöv məzmunu (və ya base64) — **ya da** aşağıdakı ikisi |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` | `client_email` və `private_key` (`\n` hərfi ilə) |
| `APP_SYNC_TOKEN` | **Tövsiyə olunur.** Login yoxdur, ona görə sinxron endpoint-lərini bu parol qoruyur; Parametrlər → Google Sheets-də eyni parolu daxil edin |

Heç bir secret koda yazılmayıb; yalnız server (API route-lar) bu dəyişənləri oxuyur və brauzerə göndərilmir.
`APP_SYNC_TOKEN` olmadan URL-i bilən hər kəs sinxron endpoint-ini çağıra bilər (məlumatı oxuyub yaza bilər) — Vercel-də mütləq təyin edin.

## 6. Vercel-ə deploy

1. Kodu GitHub-a push edin.
2. Vercel → **Add New → Project** → repo-nu seçin. **Root Directory** = `budget-app` (monorepo-dursa).
3. Framework avtomatik Next.js təyin olunur (`vercel.json` hazırdır).
4. **Settings → Environment Variables**-a yuxarıdakı dəyişənləri əlavə edin (Production + Preview).
5. **Deploy**. Sonra telefonda aç → Ana ekrana əlavə et → Parametrlər → Google Sheets → “Bağlantını yoxla” → “İndi sinxron et”.

## Necə işləyir

- **Balans məntiqi** (`src/lib/balances.ts`): gəlir `+`, xərc `−`, transfer/investisiya mənbədən `−` hədəfə `+` (valyuta fərqli olarsa `toAmount`), balans düzəlişi istiqamətə görə. Debtor/Creditor hesabları işarəli saxlayır: müsbət = mənə borcludur, mənfi = mən borcluyam (Borc vermə: Nağd → Debtor; Avans alma: Creditor → Kart). Hesablama sentlə aparılır.
- **Hesab silinməsi**: əməliyyatı olan hesab/kateqoriya silinmir, arxivləşdirilir. Silmə tombstone (`deletedAt`) ilə olur ki, sinxron da silməni daşısın.
- **Sinxron**: hər sinxronda 3 vərəq `batchGet` ilə oxunur, `updatedAt`-ə görə birləşdirilir (son dəyişiklik qalib), `batchUpdate` ilə yazılır. 429/5xx/şəbəkə xətalarında exponential backoff (+ `Retry-After`). Sheets-də oxunmayan sətir olarsa, data itkisinin qarşısını almaq üçün sinxron dayanır və hansı sətir olduğunu bildirir.
- **Avtomatik sinxron**: Parametrlərdə açılır; dəyişiklikdən ~4 san sonra (onlayn olduqda).
- **Backend-ə keçid**: `src/services/repository.ts`-dəki `Repository` interfeysini Postgres/Supabase ilə həyata keçirin; UI dəyişmir.

## Məlum məhdudiyyətlər

- Sinxron tam snapshot göndərir (Vercel sorğu limiti ~4,5MB → təxminən 10 000+ əməliyyata qədər rahat).
- Eyni anda iki cihazdan sinxron olarsa, sonuncu yazan qalib gəlir (konflikt qeyd səviyyəsində `updatedAt` ilə həll olunur).
- Sheets-də əl ilə redaktə edirsinizsə, `updatedAt` sütununu da yeniləyin, əks halda yerli dəyişiklik qalib gələ bilər.
- Cihaz saatı səhv olarsa `updatedAt` müqayisəsi təsir görür.
