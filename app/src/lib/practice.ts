import type { ContentStatus, VocabWord } from '../types';
import { getExampleDisplayBlanked, hasUsableContent, pickRandom } from './contentDisplay';

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
  const pool = buildPracticePool(words);
  if (pool.length < MIN_POOL_SIZE) return [];

  const chosen = pickRandom(pool, Math.min(count, pool.length));

  return chosen.map((word) => {
    // pool guarantees these are non-null (hasUsableContent)
    const translation = word.translationAz as string;
    const definition = word.englishDefinition as string;

    switch (mode) {
      case 'en-az': {
        const distractors = pickRandom(pool, 3, word).map((w) => w.translationAz as string);
        return {
          word,
          kind: 'choice',
          promptLabel: 'en-az',
          promptText: word.word,
          promptContentStatus: word.contentStatus,
          options: shuffle([translation, ...distractors]),
          correctAnswer: translation,
        };
      }
      case 'az-en': {
        const distractors = pickRandom(pool, 3, word).map((w) => w.word);
        return {
          word,
          kind: 'choice',
          promptLabel: 'az-en',
          promptText: translation,
          promptContentStatus: word.contentStatus,
          options: shuffle([word.word, ...distractors]),
          correctAnswer: word.word,
        };
      }
      case 'choice': {
        const distractors = pickRandom(pool, 3, word).map((w) => w.word);
        return {
          word,
          kind: 'choice',
          promptLabel: 'choice',
          promptText: definition,
          promptContentStatus: word.contentStatus,
          options: shuffle([word.word, ...distractors]),
          correctAnswer: word.word,
        };
      }
      case 'spelling': {
        return {
          word,
          kind: 'input',
          promptLabel: 'spelling',
          promptText: translation,
          promptContentStatus: word.contentStatus,
          correctAnswer: word.word,
        };
      }
      case 'sentence': {
        const blanked = getExampleDisplayBlanked(word);
        const distractors = pickRandom(pool, 3, word).map((w) => w.word);
        return {
          word,
          kind: 'choice',
          promptLabel: 'sentence',
          promptText: blanked.text,
          promptContentStatus: blanked.status,
          options: shuffle([word.word, ...distractors]),
          correctAnswer: word.word,
        };
      }
    }
  });
}

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
