import type { ReviewGrade, VocabWord, WordStatus } from '../types';

/**
 * Simple, transparent review-interval rule for this app.
 * This is an app convention for pacing revision — NOT a scientifically
 * validated spaced-repetition algorithm (e.g. SM-2) and makes no such claim.
 * All intervals are configured in one place so they're easy to tune.
 */
export const REVIEW_INTERVALS: Record<ReviewGrade, { amount: number; unit: 'hours' | 'days' }> = {
  again: { amount: 3, unit: 'hours' }, // review later today
  hard: { amount: 1, unit: 'days' }, // review tomorrow
  good: { amount: 3, unit: 'days' }, // review in 3 days
  easy: { amount: 7, unit: 'days' }, // review in 7 days
};

/** Number of consecutive "good"/"easy" answers required before a word is considered KNOWN. */
export const REPETITIONS_TO_KNOWN = 3;

/** Number of consecutive "again" answers before a word is flagged DIFFICULT. */
export const AGAIN_STREAK_TO_DIFFICULT = 2;

function addInterval(from: Date, grade: ReviewGrade): Date {
  const { amount, unit } = REVIEW_INTERVALS[grade];
  const ms = unit === 'hours' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
  return new Date(from.getTime() + ms);
}

function nextDifficulty(current: number, grade: ReviewGrade): number {
  // 0-5 scale, akin to a simple ease rating. Clamped, moves gradually.
  const delta = { again: -1.2, hard: -0.4, good: 0.2, easy: 0.6 }[grade];
  return Math.max(0, Math.min(5, Number((current + delta).toFixed(2))));
}

function nextStatus(word: VocabWord, grade: ReviewGrade, newRepetitions: number): WordStatus {
  if (word.status === 'DIFFICULT' && (grade === 'good' || grade === 'easy') && newRepetitions >= REPETITIONS_TO_KNOWN) {
    return 'KNOWN';
  }
  if (grade === 'again') {
    return 'DIFFICULT';
  }
  if (newRepetitions >= REPETITIONS_TO_KNOWN && (grade === 'good' || grade === 'easy')) {
    return 'KNOWN';
  }
  return 'LEARNING';
}

/** Applies one review answer to a word and returns the updated word (pure function). */
export function applyReview(word: VocabWord, grade: ReviewGrade, now: Date = new Date()): VocabWord {
  const isCorrect = grade !== 'again';
  const newRepetitions = isCorrect ? word.repetitions + 1 : 0;
  const correctAnswers = word.correctAnswers + (isCorrect ? 1 : 0);
  const incorrectAnswers = word.incorrectAnswers + (isCorrect ? 0 : 1);
  const totalAnswers = correctAnswers + incorrectAnswers;
  const confidenceScore = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  return {
    ...word,
    status: nextStatus(word, grade, newRepetitions),
    repetitions: newRepetitions,
    correctAnswers,
    incorrectAnswers,
    difficulty: nextDifficulty(word.difficulty, grade),
    confidenceScore,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addInterval(now, grade).toISOString(),
  };
}

function confidenceFrom(correctAnswers: number, incorrectAnswers: number): number {
  const total = correctAnswers + incorrectAnswers;
  return total > 0 ? Math.round((correctAnswers / total) * 100) : 0;
}

export function markKnown(word: VocabWord, now: Date = new Date()): VocabWord {
  const correctAnswers = word.correctAnswers + 1;
  return {
    ...word,
    status: 'KNOWN',
    correctAnswers,
    repetitions: word.repetitions + 1,
    confidenceScore: confidenceFrom(correctAnswers, word.incorrectAnswers),
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addInterval(now, 'easy').toISOString(),
  };
}

export function markDifficult(word: VocabWord, now: Date = new Date()): VocabWord {
  const incorrectAnswers = word.incorrectAnswers + 1;
  return {
    ...word,
    status: 'DIFFICULT',
    incorrectAnswers,
    difficulty: nextDifficulty(word.difficulty, 'again'),
    confidenceScore: confidenceFrom(word.correctAnswers, incorrectAnswers),
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addInterval(now, 'again').toISOString(),
  };
}

export function markReviewLater(word: VocabWord, now: Date = new Date()): VocabWord {
  return {
    ...word,
    status: word.status === 'NEW' ? 'LEARNING' : word.status,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addInterval(now, 'hard').toISOString(),
  };
}

export function isDueForReview(word: VocabWord, now: Date = new Date()): boolean {
  if (!word.nextReviewAt) return false;
  return new Date(word.nextReviewAt).getTime() <= now.getTime();
}
