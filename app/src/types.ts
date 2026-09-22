export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type WordStatus = 'NEW' | 'LEARNING' | 'KNOWN' | 'DIFFICULT';

export const WORD_STATUSES: WordStatus[] = ['NEW', 'LEARNING', 'KNOWN', 'DIFFICULT'];

/** A single part-of-speech + level pairing, for words with more than one dictionary sense. */
export interface WordSense {
  partOfSpeech: string;
  cefrLevel: CefrLevel;
}

/**
 * A vocabulary entry sourced from the Oxford 3000 / Oxford 5000 word lists.
 * Only `word`, `partOfSpeech`, `cefrLevel` (+ `allSenses`) come from the official list.
 * `pronunciation`, `translationAz`, `shortDefinition`, `exampleSentence` and `synonyms`
 * are NOT present in the source lists and stay null ("not provided") — the UI renders
 * clearly-labelled demo content for these instead of fabricating official data.
 */
export interface VocabWord {
  id: string;
  word: string;
  partOfSpeech: string;
  cefrLevel: CefrLevel;
  pronunciation: string | null;
  translationAz: string | null;
  shortDefinition: string | null;
  exampleSentence: string | null;
  synonyms: string[];

  status: WordStatus;
  repetitions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  difficulty: number;
  confidenceScore: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;

  /** Present when the same headword has more than one part-of-speech/level pairing. */
  allSenses: WordSense[] | null;
  sourceList: 'Oxford3000' | 'Oxford5000_additional';
}

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type PronunciationAccent = 'british' | 'american';

export interface AppSettings {
  dailyWordTarget: number;
  newWordsPerSession: number;
  reviewLimit: number;
  pronunciationAccent: PronunciationAccent;
  interfaceLanguage: 'az';
  theme: 'light' | 'dark' | 'system';
}

export interface DailyLogEntry {
  date: string; // YYYY-MM-DD
  wordsStudied: number;
  reviewsCompleted: number;
  correctAnswers: number;
  incorrectAnswers: number;
}

export interface ProgressState {
  streakCurrent: number;
  streakBest: number;
  lastStudyDate: string | null;
  dailyLog: Record<string, DailyLogEntry>;
}

export interface PersistedState {
  version: number;
  words: Record<string, VocabWord>;
  settings: AppSettings;
  progress: ProgressState;
}
