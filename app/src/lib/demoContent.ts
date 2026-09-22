import type { VocabWord } from '../types';

/**
 * The Oxford word lists used as the vocabulary source contain only the headword,
 * part of speech and CEFR level — no translations, definitions, example sentences
 * or audio. Per the project brief, this module generates clearly-labelled DEMO
 * placeholder content at render time so the practice modes are functional, without
 * writing fake content into the actual word data (which stays "not provided").
 * None of this is presented as real Oxford or dictionary content.
 */

export function getDisplayTranslation(word: VocabWord): { text: string; isDemo: boolean } {
  if (word.translationAz) return { text: word.translationAz, isDemo: false };
  return { text: `"${word.word}" sözünün nümunə tərcüməsi (demo)`, isDemo: true };
}

export function getDisplayDefinition(word: VocabWord): { text: string; isDemo: boolean } {
  if (word.shortDefinition) return { text: word.shortDefinition, isDemo: false };
  return { text: `"${word.word}" (${word.partOfSpeech}) üçün nümunə tərif (demo)`, isDemo: true };
}

export function getDisplayExample(word: VocabWord): { text: string; isDemo: boolean } {
  if (word.exampleSentence) return { text: word.exampleSentence, isDemo: false };
  return { text: `This is a demo sentence with the word "${word.word}".`, isDemo: true };
}

/** Same as getDisplayExample but with the target word blanked out, for sentence-completion practice. */
export function getDisplayExampleBlanked(word: VocabWord): { text: string; isDemo: boolean } {
  if (word.exampleSentence) {
    const re = new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return { text: word.exampleSentence.replace(re, '_____'), isDemo: false };
  }
  return { text: 'This is a demo sentence with the word "_____".', isDemo: true };
}

/**
 * A short, deterministic per-word token used as a stand-in "meaning" for matching-based
 * practice (EN<->AZ) when no real translation is available. Unlike getDisplayTranslation,
 * this never contains the English word itself, so it doesn't give the answer away in a
 * multiple-choice question — it exists only so distractors are distinguishable from each other.
 */
export function getPracticeMeaning(word: VocabWord): { text: string; isDemo: boolean } {
  if (word.translationAz) return { text: word.translationAz, isDemo: false };
  const code = word.id
    .split('')
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9973, 7)
    .toString()
    .padStart(4, '0');
  return { text: `demo məna #${code}`, isDemo: true };
}

/** Deterministic pseudo-random pick so the same word always gets the same demo distractors in one session. */
export function pickRandom<T>(arr: T[], count: number, exclude?: T): T[] {
  const pool = exclude ? arr.filter((x) => x !== exclude) : arr.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
