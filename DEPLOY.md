# Bu repo-da iki ayrı tətbiq var

| Tətbiq | Qovluq | Texnologiya | Vercel Root Directory |
|---|---|---|---|
| Oxford 5000 (lüğət öyrənmə) | `app/` | Vite + React | `app` |
| Büdcə (personal budget) | `budget-app/` | Next.js 15 | `budget-app` |

Hər tətbiq öz `package.json`, `vercel.json` və asılılıqlarına malikdir; biri digərindən asılı deyil.
Hər biri Vercel-də **ayrıca layihə** kimi deploy olunur (eyni GitHub repo-dan, fərqli Root Directory ilə).

## Vercel-də iki layihə
Vercel → **Add New → Project** → `TamrazH/TamrazH` repo-sunu **Import** edin. Bunu iki dəfə edin:

1. **Oxford:** Project Name `oxford-5000`, **Root Directory = `app`**, Framework avtomatik *Vite*. Deploy.
2. **Büdcə:** Project Name `budget-app`, **Root Directory = `budget-app`**, Framework avtomatik *Next.js*. Deploy.
   (Sheets istifadə edəcəksinizsə: `budget-app/README.md` → “Environment variables”.)

Build/Output Directory sahələrinə toxunmayın — `vercel.json` onları təyin edir.
Hər layihənin öz ünvanı olacaq (`oxford-5000.vercel.app`, `budget-app.vercel.app`).
Köhnə layihədə Root Directory-ni dəyişmək əvəzinə, yuxarıdakı kimi iki təmiz layihə yaratmaq daha asandır; köhnəsini silə bilərsiniz.
