export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type WordStatus = 'NEW' | 'LEARNING' | 'KNOWN' | 'DIFFICULT';

export const WORD_STATUSES: WordStatus[] = ['NEW', 'LEARNING', 'KNOWN', 'DIFFICULT'];

/** Which official word list a headword's entry originates from. */
export type SourceList = 'OXFORD_3000' | 'OXFORD_5000';

/**
 * Where a word's content (translation/definition/example) came from.
 * - VERIFIED: confirmed against an official/licensed source by a human.
 * - LICENSED: pulled from an approved dictionary API under license.
 * - OWN_CONTENT: supplied by the project owner (their own approved dataset).
 * - AI_DRAFT: AI-generated, original wording — never presented as official Oxford content.
 * - MISSING: no content yet.
 */
export type ContentStatus = 'VERIFIED' | 'LICENSED' | 'OWN_CONTENT' | 'AI_DRAFT' | 'MISSING';

export const CONTENT_STATUSES: ContentStatus[] = ['VERIFIED', 'LICENSED', 'OWN_CONTENT', 'AI_DRAFT', 'MISSING'];

/**
 * Provenance specifically for `englishDefinition`, tracked separately from the
 * general `contentStatus` (which historically covered translation/definition/
 * example together as one unit). `definitionSource` records where the text came
 * from; `definitionStatus` records its current review state. Today the two are
 * set together (nothing here has been through a separate human-review pass yet),
 * but they are kept as distinct fields so a future review workflow can promote a
 * definition's status without needing to fabricate a new "source".
 */
export type DefinitionSource = 'OXFORD_LICENSED' | 'APPROVED_DICTIONARY' | 'OWN_CONTENT' | 'AI' | 'MISSING';

export const DEFINITION_SOURCES: DefinitionSource[] = [
  'OXFORD_LICENSED',
  'APPROVED_DICTIONARY',
  'OWN_CONTENT',
  'AI',
  'MISSING',
];

/** A single part-of-speech + level pairing, for words with more than one dictionary sense. */
export interface WordSense {
  partOfSpeech: string;
  cefrLevel: CefrLevel;
}

/**
 * A vocabulary entry sourced from the Oxford 3000 / Oxford 5000 word lists.
 * Only `word`, `partOfSpeech`, `cefrLevel`, `sourceList` (+ `allSenses`) come from the
 * official list. `pronunciation`, `translationAz`, `englishDefinition`, `exampleSentence`,
 * `audioUrl` and `synonyms` are NOT present in the source lists and stay null until real
 * (verified/licensed/own) or AI_DRAFT content is imported — see `contentStatus`. The UI
 * never fabricates text for a MISSING field; it shows an explicit "not added yet" label.
 */
export interface VocabWord {
  id: string;
  word: string;
  partOfSpeech: string;
  cefrLevel: CefrLevel;

  /** Which list this headword entry belongs to. All OXFORD_3000 words are also part of
   *  the complete Oxford 5000; OXFORD_5000 here means "additional/extension word only". */
  sourceList: SourceList;
  isOxford3000: boolean;
  isAdditionalOxford5000: boolean;

  pronunciation: string | null;
  translationAz: string | null;
  englishDefinition: string | null;
  exampleSentence: string | null;
  audioUrl: string | null;
  synonyms: string[];

  /** Free-text provenance note (e.g. an API name, "project owner", "AI (Claude)"). */
  contentSource: string | null;
  contentStatus: ContentStatus;

  /** Provenance specifically for englishDefinition — see DefinitionSource doc comment. */
  definitionSource: DefinitionSource;
  definitionStatus: DefinitionSource;

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
}

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type PronunciationAccent = 'british' | 'american';

/** The four top-level learning modes shown on the home screen's mode selector. */
export type AppMode = 'OXFORD_3000' | 'OXFORD_5000' | 'REVIEW_DUE' | 'DIFFICULT';

export const APP_MODES: AppMode[] = ['OXFORD_3000', 'OXFORD_5000', 'REVIEW_DUE', 'DIFFICULT'];

/** Within Oxford 5000 mode, whether a lesson draws from the complete list or just the extension. */
export type Oxford5000Scope = 'ALL' | 'ADDITIONAL_ONLY';

/** How a lesson's word order is generated. MIXED is the smart default; ALPHABETICAL is opt-in. */
export type ReviewStrategy = 'MIXED' | 'REVIEW_FIRST' | 'NEW_FIRST' | 'DIFFICULT_FIRST' | 'ALPHABETICAL';

export const REVIEW_STRATEGIES: ReviewStrategy[] = ['MIXED', 'REVIEW_FIRST', 'NEW_FIRST', 'DIFFICULT_FIRST', 'ALPHABETICAL'];

export const SESSION_SIZES = [5, 10, 20, 30] as const;
export type SessionSize = (typeof SESSION_SIZES)[number];

export interface AppSettings {
  dailyWordTarget: number;
  newWordsPerSession: number;
  reviewLimit: number;
  pronunciationAccent: PronunciationAccent;
  interfaceLanguage: 'az';
  theme: 'light' | 'dark' | 'system';
  activeMode: AppMode;
  reviewStrategy: ReviewStrategy;
  sessionSize: SessionSize;
  /** Global Azerbaijani-translation visibility, set on the entry screen and changeable in Settings. */
  showTranslation: boolean;
  /** Whether the one-time welcome/setup screen has been completed. */
  hasCompletedOnboarding: boolean;
}

/**
 * A generated lesson word order, snapshotted at creation time so it survives refresh
 * and so the user can resume an unfinished lesson instead of getting a new order every
 * time. Only regenerated when the user explicitly starts a new session (or the day
 * changes and the "for today" queue is naturally superseded).
 */
export interface StudySession {
  sessionId: string;
  mode: AppMode;
  oxford5000Scope: Oxford5000Scope;
  reviewStrategy: ReviewStrategy;
  sessionSize: number;
  wordIds: string[];
  currentIndex: number;
  createdDateKey: string; // YYYY-MM-DD, the deterministic-shuffle seed date
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
  studySession: StudySession | null;
}
