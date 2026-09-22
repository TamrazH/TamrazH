import type { VocabWord } from '../types';
import { getDisplayDefinition, getDisplayExampleBlanked, getPracticeMeaning, pickRandom } from './demoContent';

export type PracticeMode = 'en-az' | 'az-en' | 'choice' | 'spelling' | 'sentence';

export const PRACTICE_MODES: PracticeMode[] = ['en-az', 'az-en', 'choice', 'spelling', 'sentence'];

export interface PracticeQuestion {
  word: VocabWord;
  kind: 'choice' | 'input';
  promptLabel: string;
  promptText: string;
  promptIsDemo: boolean;
  options?: string[];
  correctAnswer: string;
}

const MIN_POOL_SIZE = 4;

export function buildPracticePool(words: Record<string, VocabWord>): VocabWord[] {
  const all = Object.values(words);
  const touched = all.filter((w) => w.status !== 'NEW');
  return touched.length >= MIN_POOL_SIZE ? touched : all;
}

export function buildQuestions(mode: PracticeMode, words: Record<string, VocabWord>, count: number): PracticeQuestion[] {
  const pool = buildPracticePool(words);
  if (pool.length < MIN_POOL_SIZE) return [];

  const chosen = pickRandom(pool, Math.min(count, pool.length));

  return chosen.map((word) => {
    switch (mode) {
      case 'en-az': {
        const meaning = getPracticeMeaning(word);
        const distractors = pickRandom(pool, 3, word).map((w) => getPracticeMeaning(w).text);
        return {
          word,
          kind: 'choice',
          promptLabel: 'en-az',
          promptText: word.word,
          promptIsDemo: meaning.isDemo,
          options: shuffle([meaning.text, ...distractors]),
          correctAnswer: meaning.text,
        };
      }
      case 'az-en': {
        const meaning = getPracticeMeaning(word);
        const distractors = pickRandom(pool, 3, word).map((w) => w.word);
        return {
          word,
          kind: 'choice',
          promptLabel: 'az-en',
          promptText: meaning.text,
          promptIsDemo: meaning.isDemo,
          options: shuffle([word.word, ...distractors]),
          correctAnswer: word.word,
        };
      }
      case 'choice': {
        const definition = getDisplayDefinition(word);
        const distractors = pickRandom(pool, 3, word).map((w) => w.word);
        return {
          word,
          kind: 'choice',
          promptLabel: 'choice',
          promptText: definition.text,
          promptIsDemo: definition.isDemo,
          options: shuffle([word.word, ...distractors]),
          correctAnswer: word.word,
        };
      }
      case 'spelling': {
        const meaning = getPracticeMeaning(word);
        return {
          word,
          kind: 'input',
          promptLabel: 'spelling',
          promptText: meaning.text,
          promptIsDemo: meaning.isDemo,
          correctAnswer: word.word,
        };
      }
      case 'sentence': {
        const blanked = getDisplayExampleBlanked(word);
        const distractors = pickRandom(pool, 3, word).map((w) => w.word);
        return {
          word,
          kind: 'choice',
          promptLabel: 'sentence',
          promptText: blanked.text,
          promptIsDemo: blanked.isDemo,
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
