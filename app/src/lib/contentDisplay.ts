import type { ContentStatus, VocabWord } from '../types';
import { t } from './i18n';

/**
 * Content display rule (per the dual-mode/content-source spec): a missing field is
 * NEVER filled with fabricated placeholder text. It shows an explicit "not added yet"
 * label instead, and the field's real status badge (AI_DRAFT/OWN_CONTENT/LICENSED/
 * VERIFIED) only appears once real content exists.
 */
export interface DisplayField {
  text: string;
  status: ContentStatus;
  isMissing: boolean;
}

function field(value: string | null, status: ContentStatus): DisplayField {
  if (value) return { text: value, status, isMissing: false };
  return { text: t.missingContent, status: 'MISSING', isMissing: true };
}

export function getTranslationDisplay(word: VocabWord): DisplayField {
  return field(word.translationAz, word.contentStatus);
}

export function getDefinitionDisplay(word: VocabWord): DisplayField {
  return field(word.englishDefinition, word.contentStatus);
}

export function getExampleDisplay(word: VocabWord): DisplayField {
  return field(word.exampleSentence, word.contentStatus);
}

/** Example sentence with the target word blanked out, for sentence-completion practice. */
export function getExampleDisplayBlanked(word: VocabWord): DisplayField {
  if (!word.exampleSentence) return field(null, word.contentStatus);
  const re = new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return { text: word.exampleSentence.replace(re, '_____'), status: word.contentStatus, isMissing: false };
}

/** A word is usable in practice modes only once it has real translation + definition + example content. */
export function hasUsableContent(word: VocabWord): boolean {
  return Boolean(word.translationAz && word.englishDefinition && word.exampleSentence);
}

export function pickRandom<T>(arr: T[], count: number, exclude?: T): T[] {
  const pool = exclude ? arr.filter((x) => x !== exclude) : arr.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
