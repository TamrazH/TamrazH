import { create } from 'zustand';
import { loadState, saveState, clearState } from '../lib/storage';
import { todayKey, daysBetween } from '../lib/date';
import type { AppMode, AppSettings, Oxford5000Scope, PersistedState, ProgressState, ReviewGrade, StudySession, VocabWord } from '../types';
import { applyReview, markDifficult as srsMarkDifficult, markKnown as srsMarkKnown, markReviewLater as srsMarkReviewLater } from '../lib/srs';
import { applyImportRows, type ValidatedRow } from '../lib/importValidation';
import { getStudyQueue } from '../lib/studyQueue';

const STATE_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  dailyWordTarget: 20,
  newWordsPerSession: 10,
  reviewLimit: 30,
  pronunciationAccent: 'american',
  interfaceLanguage: 'az',
  theme: 'system',
  activeMode: 'OXFORD_3000',
  reviewStrategy: 'MIXED',
  sessionSize: 10,
  showTranslation: true,
  hasCompletedOnboarding: false,
};

const DEFAULT_PROGRESS: ProgressState = {
  streakCurrent: 0,
  streakBest: 0,
  lastStudyDate: null,
  dailyLog: {},
};

/**
 * The 5000-word dataset is served as a static asset (public/data/vocabulary.json)
 * rather than bundled into the JS, so the app shell stays small and the word list
 * is cached independently by the service worker for offline use.
 */
let cachedVocabulary: VocabWord[] | null = null;

async function fetchVocabulary(): Promise<VocabWord[]> {
  if (cachedVocabulary) return cachedVocabulary;
  const res = await fetch(`${import.meta.env.BASE_URL}data/vocabulary.json`);
  const data = (await res.json()) as VocabWord[];
  cachedVocabulary = data;
  return data;
}

function wordsById(list: VocabWord[]): Record<string, VocabWord> {
  const map: Record<string, VocabWord> = {};
  for (const w of list) map[w.id] = w;
  return map;
}

/**
 * Only these fields are per-user learning progress and should survive a dataset update.
 * Everything else (word, translationAz, englishDefinition, exampleSentence, contentStatus,
 * contentSource, etc.) must always come from the freshly-shipped dataset — otherwise a
 * user's old cached save (from before content was enriched) would keep overwriting new
 * content with its stale MISSING/null values forever.
 */
const PROGRESS_FIELDS = [
  'status',
  'repetitions',
  'correctAnswers',
  'incorrectAnswers',
  'difficulty',
  'confidenceScore',
  'lastReviewedAt',
  'nextReviewAt',
] as const satisfies readonly (keyof VocabWord)[];

function mergeProgressOnto(freshWord: VocabWord, persistedWord: VocabWord): VocabWord {
  const merged = { ...freshWord };
  for (const key of PROGRESS_FIELDS) {
    (merged as Record<string, unknown>)[key] = persistedWord[key];
  }
  return merged;
}

/** Only safe to call once `fetchVocabulary` has resolved at least once (i.e. after hydrate()). */
function buildDefaultWords(): Record<string, VocabWord> {
  return wordsById(cachedVocabulary ?? []);
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(state: PersistedState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void saveState(state);
  }, 300);
}

interface AppState {
  hydrated: boolean;
  words: Record<string, VocabWord>;
  settings: AppSettings;
  progress: ProgressState;
  studySession: StudySession | null;

  hydrate: () => Promise<void>;
  applyGrade: (id: string, grade: ReviewGrade) => void;
  markKnown: (id: string) => void;
  markDifficult: (id: string) => void;
  markReviewLater: (id: string) => void;
  recordWordsStudied: (count: number) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetProgress: () => Promise<void>;
  importState: (imported: PersistedState) => void;
  applyContentImport: (validatedRows: ValidatedRow[]) => void;
  /** Resumes today's unfinished session for this mode/scope if one matches, else starts a fresh one. */
  ensureStudySession: (mode: AppMode, oxford5000Scope: Oxford5000Scope) => void;
  /** Always generates a fresh session, discarding any unfinished one — "Start new session". */
  startNewStudySession: (mode: AppMode, oxford5000Scope: Oxford5000Scope) => void;
  advanceStudySession: () => void;
  /** "Random shuffle now" from Settings: clears the saved session so the next lesson regenerates. */
  clearStudySession: () => void;
}

function persistedSnapshot(state: AppState): PersistedState {
  return {
    version: STATE_VERSION,
    words: state.words,
    settings: state.settings,
    progress: state.progress,
    studySession: state.studySession,
  };
}

function buildStudySession(
  words: Record<string, VocabWord>,
  settings: AppSettings,
  mode: AppMode,
  oxford5000Scope: Oxford5000Scope,
): StudySession {
  const today = todayKey();
  const wordIds = getStudyQueue({
    mode,
    oxford5000Scope,
    sessionSize: settings.sessionSize,
    reviewStrategy: settings.reviewStrategy,
    date: new Date(),
    words,
  });
  return {
    sessionId: `${today}-${mode}-${oxford5000Scope}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    oxford5000Scope,
    reviewStrategy: settings.reviewStrategy,
    sessionSize: settings.sessionSize,
    wordIds,
    currentIndex: 0,
    createdDateKey: today,
  };
}

function bumpStreakIfNeeded(progress: ProgressState): ProgressState {
  const today = todayKey();
  if (progress.lastStudyDate === today) return progress;

  let streakCurrent = 1;
  if (progress.lastStudyDate) {
    const gap = daysBetween(progress.lastStudyDate, today);
    streakCurrent = gap === 1 ? progress.streakCurrent + 1 : 1;
  }
  return {
    ...progress,
    streakCurrent,
    streakBest: Math.max(progress.streakBest, streakCurrent),
    lastStudyDate: today,
  };
}

function touchDailyLog(progress: ProgressState, patch: Partial<{ wordsStudied: number; reviewsCompleted: number; correctAnswers: number; incorrectAnswers: number }>): ProgressState {
  const today = todayKey();
  const existing = progress.dailyLog[today] ?? {
    date: today,
    wordsStudied: 0,
    reviewsCompleted: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
  };
  const updated = {
    ...existing,
    wordsStudied: existing.wordsStudied + (patch.wordsStudied ?? 0),
    reviewsCompleted: existing.reviewsCompleted + (patch.reviewsCompleted ?? 0),
    correctAnswers: existing.correctAnswers + (patch.correctAnswers ?? 0),
    incorrectAnswers: existing.incorrectAnswers + (patch.incorrectAnswers ?? 0),
  };
  const bumped = bumpStreakIfNeeded(progress);
  return { ...bumped, dailyLog: { ...bumped.dailyLog, [today]: updated } };
}

export const useAppStore = create<AppState>((set) => ({
  hydrated: false,
  words: {},
  settings: DEFAULT_SETTINGS,
  progress: DEFAULT_PROGRESS,
  studySession: null,

  hydrate: async () => {
    const vocabulary = await fetchVocabulary();
    const defaults = wordsById(vocabulary);
    const persisted = await loadState();
    if (persisted && persisted.version === STATE_VERSION) {
      // carry over only progress fields onto the canonical (static) word list so that
      // dataset content updates (new translations/definitions/examples) on our side
      // are never shadowed by a stale saved copy of the old content.
      const merged: Record<string, VocabWord> = { ...defaults };
      for (const id of Object.keys(persisted.words)) {
        if (merged[id]) merged[id] = mergeProgressOnto(merged[id], persisted.words[id]);
      }
      set({
        words: merged,
        settings: { ...DEFAULT_SETTINGS, ...persisted.settings },
        progress: { ...DEFAULT_PROGRESS, ...persisted.progress },
        studySession: persisted.studySession ?? null,
        hydrated: true,
      });
    } else {
      set({ words: defaults, hydrated: true });
    }
  },

  applyGrade: (id, grade) => {
    set((state) => {
      const word = state.words[id];
      if (!word) return state;
      const updated = applyReview(word, grade);
      const isCorrect = grade !== 'again';
      const progress = touchDailyLog(state.progress, {
        reviewsCompleted: 1,
        correctAnswers: isCorrect ? 1 : 0,
        incorrectAnswers: isCorrect ? 0 : 1,
      });
      const next = { ...state, words: { ...state.words, [id]: updated }, progress };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  markKnown: (id) => {
    set((state) => {
      const word = state.words[id];
      if (!word) return state;
      const updated = srsMarkKnown(word);
      const progress = touchDailyLog(state.progress, { reviewsCompleted: 1, correctAnswers: 1 });
      const next = { ...state, words: { ...state.words, [id]: updated }, progress };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  markDifficult: (id) => {
    set((state) => {
      const word = state.words[id];
      if (!word) return state;
      const updated = srsMarkDifficult(word);
      const progress = touchDailyLog(state.progress, { reviewsCompleted: 1, incorrectAnswers: 1 });
      const next = { ...state, words: { ...state.words, [id]: updated }, progress };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  markReviewLater: (id) => {
    set((state) => {
      const word = state.words[id];
      if (!word) return state;
      const updated = srsMarkReviewLater(word);
      const next = { ...state, words: { ...state.words, [id]: updated } };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  recordWordsStudied: (count) => {
    set((state) => {
      const progress = touchDailyLog(state.progress, { wordsStudied: count });
      const next = { ...state, progress };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  updateSettings: (partial) => {
    set((state) => {
      const next = { ...state, settings: { ...state.settings, ...partial } };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  resetProgress: async () => {
    await clearState();
    const next: Pick<AppState, 'words' | 'settings' | 'progress' | 'studySession'> = {
      words: buildDefaultWords(),
      settings: DEFAULT_SETTINGS,
      progress: DEFAULT_PROGRESS,
      studySession: null,
    };
    set(next);
    await saveState({ version: STATE_VERSION, ...next });
  },

  importState: (imported) => {
    const defaults = buildDefaultWords();
    const merged: Record<string, VocabWord> = { ...defaults };
    for (const id of Object.keys(imported.words || {})) {
      if (merged[id]) merged[id] = mergeProgressOnto(merged[id], imported.words[id]);
    }
    const next = {
      words: merged,
      settings: { ...DEFAULT_SETTINGS, ...imported.settings },
      progress: { ...DEFAULT_PROGRESS, ...imported.progress },
      studySession: imported.studySession ?? null,
    };
    set(next);
    schedulePersist({ version: STATE_VERSION, ...next });
  },

  applyContentImport: (validatedRows) => {
    set((state) => {
      const words = applyImportRows(state.words, validatedRows);
      const next = { ...state, words };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  ensureStudySession: (mode, oxford5000Scope) => {
    set((state) => {
      const today = todayKey();
      const s = state.studySession;
      const matches =
        s &&
        s.mode === mode &&
        s.oxford5000Scope === oxford5000Scope &&
        s.reviewStrategy === state.settings.reviewStrategy &&
        s.sessionSize === state.settings.sessionSize &&
        s.createdDateKey === today;
      if (matches) return state;

      const studySession = buildStudySession(state.words, state.settings, mode, oxford5000Scope);
      const next = { ...state, studySession };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  startNewStudySession: (mode, oxford5000Scope) => {
    set((state) => {
      const studySession = buildStudySession(state.words, state.settings, mode, oxford5000Scope);
      const next = { ...state, studySession };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  advanceStudySession: () => {
    set((state) => {
      if (!state.studySession) return state;
      const studySession = { ...state.studySession, currentIndex: state.studySession.currentIndex + 1 };
      const next = { ...state, studySession };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },

  clearStudySession: () => {
    set((state) => {
      const next = { ...state, studySession: null };
      schedulePersist(persistedSnapshot(next));
      return next;
    });
  },
}));
