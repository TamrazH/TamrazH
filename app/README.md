# Oxford Söz Ehtiyatı

A mobile-first, offline-capable PWA for studying English vocabulary from the
Oxford 3000 / Oxford 5000 word lists, with an Azerbaijani interface. Built as
a personal single-learner prototype — no backend, no accounts, no analytics.

## Data source & licensing

- The vocabulary (headword, part of speech, CEFR level) is extracted from the
  two official Oxford word-list PDFs the project owner uploaded (American
  Oxford 3000 and the Oxford 5000 "additional 2000 words" supplement,
  © Oxford University Press). Extraction was verified and confirmed before
  the dataset was built — see the extraction report from that step for
  counts, duplicates, and edge cases.
- **No official Oxford definitions, translations, example sentences, IPA
  transcriptions, or audio are included** — the source PDFs don't contain
  them. Those fields stay `null` ("not provided") in `public/data/vocabulary.json`.
- Wherever the UI needs that content to be functional (study cards, flashcards,
  practice modes), it generates clearly-labelled **"demo"** placeholder text
  at render time (see `src/lib/demoContent.ts`). This is never presented as
  real dictionary content.
- Pronunciation uses the browser's built-in Web Speech API (`speechSynthesis`)
  — no bundled or copyrighted audio.
- All progress data stays in the browser (IndexedDB, with a localStorage
  fallback). Nothing is sent to a server; there is no backend.

## Review algorithm

A simple, transparent app rule — **not** a validated spaced-repetition
algorithm (e.g. SM-2), and it doesn't claim to be:

| Grade  | Next review |
|--------|--------------|
| Again  | later today (+3h) |
| Hard   | tomorrow (+1 day) |
| Good   | in 3 days |
| Easy   | in 7 days |

Configured in one place: `src/lib/srs.ts`.

## Development

```sh
npm install
npm run dev       # dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Structure

- `public/data/vocabulary.json` — the 5000-word dataset (static asset, fetched
  once at startup and cached by the service worker for offline use).
- `src/types.ts` — data model.
- `src/lib/` — SRS logic, i18n (Azerbaijani strings), storage, demo-content
  generation, practice-question generation, export/import.
- `src/store/useAppStore.ts` — Zustand store (words, settings, progress).
- `src/screens/` — one file per screen (Home, Word Study, Flashcards,
  Practice, Word List/Detail, Progress, Settings).
- `scripts/generate-icons.mjs` — regenerates `public/icons/*.png` from
  `scripts/icon.svg` (requires `sharp`, a one-off dev dependency not kept
  installed).

## PWA

Installable as a home-screen app (manifest + service worker via
`vite-plugin-pwa`). The app shell is precached; the vocabulary dataset is
cached on first load (cache-first) so it's available offline afterwards.
