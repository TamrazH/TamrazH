import { CEFR_LEVELS, type VocabWord, type WordStatus } from '../types';
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
