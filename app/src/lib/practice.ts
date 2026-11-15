import type { ContentStatus, VocabWord } from '../types';
import { getExampleDisplayBlanked, hasUsableContent, pickRandom, spokenForm } from './contentDisplay';

export type PracticeMode = 'en-az' | 'az-en' | 'choice' | 'spelling' | 'sentence';

export const PRACTICE_MODES: PracticeMode[] = ['en-az', 'az-en', 'choice', 'spelling', 'sentence'];

export interface PracticeQuestion {
  word: VocabWord;
  kind: 'choice' | 'input';
  promptLabel: string;
  promptText: string;
  promptContentStatus: ContentStatus;
  options?: string[];
  correctAnswer: string;
}

const MIN_POOL_SIZE = 4;

/**
 * Practice modes only draw on words that actually have real content (translation,
 * definition, example) — never fabricated placeholders. Until a word is enriched
 * (AI_DRAFT or better), it simply isn't eligible for practice.
 */
export function buildPracticePool(words: Record<string, VocabWord>): VocabWord[] {
  const withContent = Object.values(words).filter(hasUsableContent);
  const touched = withContent.filter((w) => w.status !== 'NEW');
  return touched.length >= MIN_POOL_SIZE ? touched : withContent;
}

export function buildQuestions(mode: PracticeMode, words: Record<string, VocabWord>, count: number): PracticeQuestion[] {
  let pool = buildPracticePool(words);
  // sentence mode needs a sentence whose blank actually hides the word
  if (mode === 'sentence') pool = pool.filter((w) => getExampleDisplayBlanked(w));
  if (pool.length < MIN_POOL_SIZE) return [];

  const chosen = pickRandom(pool, Math.min(count, pool.length));

  return chosen.map((word) => {
    // pool guarantees these are non-null (hasUsableContent)
    const translation = word.translationAz as string;
    const definition = word.englishDefinition as string;
    const headword = spokenForm(word.word);
    const headwordOptions = () => shuffle([headword, ...distractors(pool, word, (w) => spokenForm(w.word), headword)]);

    switch (mode) {
      case 'en-az':
        return {
          word,
          kind: 'choice',
          promptLabel: 'en-az',
          promptText: headword,
          promptContentStatus: word.contentStatus,
          options: shuffle([translation, ...distractors(pool, word, (w) => w.translationAz as string, translation)]),
          correctAnswer: translation,
        };
      case 'az-en':
        return {
          word,
          kind: 'choice',
          promptLabel: 'az-en',
          promptText: translation,
          promptContentStatus: word.contentStatus,
          options: headwordOptions(),
          correctAnswer: headword,
        };
      case 'choice':
        return {
          word,
          kind: 'choice',
          promptLabel: 'choice',
          promptText: definition,
          promptContentStatus: word.contentStatus,
          options: headwordOptions(),
          correctAnswer: headword,
        };
      case 'spelling':
        return {
          word,
          kind: 'input',
          promptLabel: 'spelling',
          promptText: translation,
          promptContentStatus: word.contentStatus,
          correctAnswer: headword,
        };
      case 'sentence': {
        const blanked = getExampleDisplayBlanked(word)!;
        return {
          word,
          kind: 'choice',
          promptLabel: 'sentence',
          promptText: blanked.text,
          promptContentStatus: blanked.status,
          options: headwordOptions(),
          correctAnswer: headword,
        };
      }
    }
  });
}

/** Three wrong options, never equal to the answer or to each other (several words share a translation or headword). */
function distractors(pool: VocabWord[], word: VocabWord, label: (w: VocabWord) => string, answer: string): string[] {
  const seen = new Set([answer.toLowerCase()]);
  const out: string[] = [];
  for (const w of pickRandom(pool, pool.length, word)) {
    const value = label(w);
    if (seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
    if (out.length === 3) break;
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
