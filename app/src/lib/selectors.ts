import { CEFR_LEVELS, type AppMode, type Oxford5000Scope, type VocabWord, type WordStatus } from '../types';
import { isDueForReview } from './srs';

export function getAllWords(words: Record<string, VocabWord>): VocabWord[] {
  return Object.values(words);
}

export function getDueWords(words: Record<string, VocabWord>, now: Date = new Date()): VocabWord[] {
  return getAllWords(words).filter((w) => w.status !== 'KNOWN' && isDueForReview(w, now));
}

export function getNewWords(words: Record<string, VocabWord>): VocabWord[] {
  return getAllWords(words).filter((w) => w.status === 'NEW');
}

export function getDifficultWords(words: Record<string, VocabWord>): VocabWord[] {
  return getAllWords(words).filter((w) => w.status === 'DIFFICULT');
}

export function getKnownWords(words: Record<string, VocabWord>): VocabWord[] {
  return getAllWords(words).filter((w) => w.status === 'KNOWN');
}

export function getStudiedWords(words: Record<string, VocabWord>): VocabWord[] {
  return getAllWords(words).filter((w) => w.status !== 'NEW');
}

export interface CefrProgress {
  level: string;
  total: number;
  known: number;
  studied: number;
}

export function getCefrProgress(words: Record<string, VocabWord>): CefrProgress[] {
  const all = getAllWords(words);
  return CEFR_LEVELS.map((level) => {
    const inLevel = all.filter((w) => w.cefrLevel === level);
    return {
      level,
      total: inLevel.length,
      known: inLevel.filter((w) => w.status === 'KNOWN').length,
      studied: inLevel.filter((w) => w.status !== 'NEW').length,
    };
  });
}

export function countByStatus(words: Record<string, VocabWord>): Record<WordStatus, number> {
  const all = getAllWords(words);
  return {
    NEW: all.filter((w) => w.status === 'NEW').length,
    LEARNING: all.filter((w) => w.status === 'LEARNING').length,
    KNOWN: all.filter((w) => w.status === 'KNOWN').length,
    DIFFICULT: all.filter((w) => w.status === 'DIFFICULT').length,
  };
}

export function getPartsOfSpeech(words: Record<string, VocabWord>): string[] {
  const set = new Set<string>();
  for (const w of Object.values(words)) set.add(w.partOfSpeech);
  return Array.from(set).sort();
}

// --- Mode scoping (Oxford 3000 / Oxford 5000) -----------------------------------

export function getOxford3000Words(words: Record<string, VocabWord>): VocabWord[] {
  return getAllWords(words).filter((w) => w.isOxford3000);
}

export function getOxford5000AdditionalWords(words: Record<string, VocabWord>): VocabWord[] {
  return getAllWords(words).filter((w) => w.isAdditionalOxford5000);
}

/** The word pool a study/practice session should draw from for a given home-screen mode. */
export function getWordPoolForMode(
  words: Record<string, VocabWord>,
  mode: AppMode,
  oxford5000Scope: Oxford5000Scope = 'ALL',
): VocabWord[] {
  switch (mode) {
    case 'OXFORD_3000':
      return getOxford3000Words(words);
    case 'OXFORD_5000':
      return oxford5000Scope === 'ADDITIONAL_ONLY' ? getOxford5000AdditionalWords(words) : getAllWords(words);
    case 'REVIEW_DUE':
      return getDueWords(words);
    case 'DIFFICULT':
      return getDifficultWords(words);
  }
}

export interface ModeStats {
  total: number;
  studied: number;
  known: number;
  difficult: number;
  due: number;
}

export function computeStats(list: VocabWord[], now: Date = new Date()): ModeStats {
  return {
    total: list.length,
    studied: list.filter((w) => w.status !== 'NEW').length,
    known: list.filter((w) => w.status === 'KNOWN').length,
    difficult: list.filter((w) => w.status === 'DIFFICULT').length,
    due: list.filter((w) => w.status !== 'KNOWN' && isDueForReview(w, now)).length,
  };
}

export function getOxford3000Stats(words: Record<string, VocabWord>): ModeStats {
  return computeStats(getOxford3000Words(words));
}

export interface Oxford5000Stats {
  foundation: ModeStats; // the Oxford 3000 words, as included foundation words
  additional: ModeStats; // the extra ~2000 Oxford 5000 words
  complete: ModeStats; // all 5000, deduplicated (foundation + additional, no double count)
}

export function getOxford5000Stats(words: Record<string, VocabWord>): Oxford5000Stats {
  return {
    foundation: computeStats(getOxford3000Words(words)),
    additional: computeStats(getOxford5000AdditionalWords(words)),
    complete: computeStats(getAllWords(words)),
  };
}
