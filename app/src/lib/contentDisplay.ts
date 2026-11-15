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

/** Headword without homograph numbers or sense labels ("can1" -> "can", "bank (money)" -> "bank"). */
export function spokenForm(headword: string): string {
  return headword.replace(/\s*\(.*\)$/, '').replace(/\d+$/, '').trim();
}

/** The sense label of a homograph headword ("bank (money)" -> "money"), if any. */
export function senseLabel(headword: string): string | null {
  return headword.match(/\((.*)\)$/)?.[1] ?? null;
}

/** Answers accepted for a headword: "a, an" accepts "a", "an" and "a, an". */
export function acceptedAnswers(headword: string): string[] {
  const base = spokenForm(headword);
  return [base, ...base.split(/,\s*/)].map((s) => s.trim().toLowerCase());
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

/**
 * Example sentence with the target word blanked out, for sentence-completion practice.
 * Matches regular inflections too (abandon -> abandoned, apply -> applied, arise -> arising);
 * returns null when the sentence uses an irregular form the blank can't hide (be -> was).
 */
export function getExampleDisplayBlanked(word: VocabWord): DisplayField | null {
  if (!word.exampleSentence) return null;
  const base = spokenForm(word.word).split(/,\s*/)[0];
  let stem = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/[^aeiou]y$/i.test(base)) stem = stem.slice(0, -1) + '(?:y|i)';
  else if (/e$/i.test(base)) stem = stem.slice(0, -1) + 'e?';
  const doubled = /[bdgklmnprtz]$/i.test(base) ? `${base.at(-1)}?` : '';
  const re = new RegExp(`\\b${stem}${doubled}(?:s|es|ed|d|ing|er|ers|est)?\\b`, 'i');
  if (!re.test(word.exampleSentence)) return null;
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
