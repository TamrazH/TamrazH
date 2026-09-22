import { isDueForReview } from './srs';
import { getOxford3000Words, getOxford5000AdditionalWords, getAllWords } from './selectors';
import type { AppMode, Oxford5000Scope, ReviewStrategy, VocabWord } from '../types';

/**
 * Builds the ordered list of word IDs for a lesson ("Start today's lesson").
 *
 * This module is pure and UI-free by design: given the same arguments it always
 * returns the same order (the randomness is a seeded shuffle, not Math.random()),
 * so the caller is responsible for snapshotting the result into a persisted
 * StudySession if it wants the order to survive a refresh — this function itself
 * does not read or write storage.
 *
 * Ordering never changes word data or progress; it only decides display order.
 */

export interface GetStudyQueueArgs {
  mode: AppMode;
  oxford5000Scope: Oxford5000Scope;
  sessionSize: number;
  reviewStrategy: ReviewStrategy;
  /** Used both to scope "recently learned" and to seed the daily shuffle. */
  date: Date;
  words: Record<string, VocabWord>;
}

// How many days a KNOWN word still counts as "recently learned" and is eligible
// for light reinforcement in a mixed lesson. Older KNOWN words are considered
// stable and are left out so lessons stay focused on words that still need work.
const RECENTLY_LEARNED_WINDOW_DAYS = 14;

// A word is "low confidence" below this score (0-100), independent of status,
// and gets pulled into the lesson for extra practice even if not yet due.
const LOW_CONFIDENCE_THRESHOLD = 50;

// Weighted round-robin weights for the five priority tiers, used only in MIXED
// mode. Higher weight = appears more often/earlier on average, but tiers stay
// interleaved throughout instead of being shown as separate blocks — this is
// what makes the default feel "combined" rather than strictly front-loaded.
const MIXED_TIER_WEIGHTS = [5, 4, 3, 2, 1] as const;

// Consecutive-run limits used by the anti-repetition repair pass.
const MAX_CONSECUTIVE_SAME_CEFR = 2;

function getPool(mode: AppMode, oxford5000Scope: Oxford5000Scope, words: Record<string, VocabWord>): VocabWord[] {
  if (mode === 'OXFORD_3000') return getOxford3000Words(words);
  if (mode === 'OXFORD_5000') {
    return oxford5000Scope === 'ADDITIONAL_ONLY' ? getOxford5000AdditionalWords(words) : getAllWords(words);
  }
  // REVIEW_DUE / DIFFICULT home-screen modes use their own simple flows
  // (Flashcards / Word List) rather than this mixed-lesson queue.
  return getAllWords(words);
}

function daysBetween(a: string, b: Date): number {
  const ms = b.getTime() - new Date(a).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Splits the pool into five mutually-exclusive priority tiers (a word is placed
 * in only the first tier it qualifies for), per the required priority order:
 *   1. due for review
 *   2. difficult
 *   3. new
 *   4. low confidence score
 *   5. recently learned (needs light reinforcement)
 * Words that don't qualify for any tier (fully mastered, not reviewed recently)
 * are left out of the lesson entirely — they don't need practice right now.
 */
function buildPriorityTiers(pool: VocabWord[], date: Date): VocabWord[][] {
  const seen = new Set<string>();
  const tiers: VocabWord[][] = [[], [], [], [], []];

  const place = (word: VocabWord, tierIndex: number) => {
    if (seen.has(word.id)) return;
    seen.add(word.id);
    tiers[tierIndex].push(word);
  };

  for (const w of pool) if (w.status !== 'KNOWN' && isDueForReview(w, date)) place(w, 0);
  for (const w of pool) if (w.status === 'DIFFICULT') place(w, 1);
  for (const w of pool) if (w.status === 'NEW') place(w, 2);
  for (const w of pool) if (w.confidenceScore < LOW_CONFIDENCE_THRESHOLD) place(w, 3);
  for (const w of pool) {
    if (w.status === 'KNOWN' && w.lastReviewedAt && daysBetween(w.lastReviewedAt, date) <= RECENTLY_LEARNED_WINDOW_DAYS) {
      place(w, 4);
    }
  }

  return tiers;
}

// --- Deterministic daily shuffle -------------------------------------------------

function hashStringToSeed(input: string): number {
  // djb2 — small, fast, good enough distribution for a shuffle seed (not crypto).
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using a seeded RNG, so the same seed always gives the same order. */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// --- Weighted round-robin interleave ---------------------------------------------

/**
 * Interleaves tiers by weight (smooth weighted round-robin): at each step, picks
 * from whichever tier currently has the highest "credit" (weight accumulated
 * since it last went), then resets that tier's credit by subtracting the total
 * weight. This spreads higher-priority tiers more densely throughout the queue
 * without shutting out lower tiers, which is what makes the result feel
 * "combined and varied" rather than a strict priority-ordered block list.
 */
function weightedInterleave(tiers: VocabWord[][], weights: readonly number[]): VocabWord[] {
  const cursors = tiers.map(() => 0);
  const credits = tiers.map(() => 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const totalItems = tiers.reduce((sum, t) => sum + t.length, 0);
  const out: VocabWord[] = [];

  while (out.length < totalItems) {
    for (let i = 0; i < tiers.length; i++) credits[i] += weights[i];
    let pick = -1;
    let best = -Infinity;
    for (let i = 0; i < tiers.length; i++) {
      if (cursors[i] >= tiers[i].length) continue;
      if (credits[i] > best) {
        best = credits[i];
        pick = i;
      }
    }
    if (pick === -1) break; // all tiers exhausted
    out.push(tiers[pick][cursors[pick]]);
    cursors[pick]++;
    credits[pick] -= totalWeight;
  }
  return out;
}

// --- Anti-repetition repair pass --------------------------------------------------

/** First part-of-speech token (e.g. "n." out of "n., adv.") used to compare "same POS". */
function primaryPos(word: VocabWord): string {
  return word.partOfSpeech.split(/[;,/]/)[0].trim().toLowerCase();
}

/**
 * Best-effort greedy repair: walks the sequence and, whenever the next word would
 * violate a hard rule (same part of speech as the previous word, or extends a run
 * of the same CEFR level beyond the allowed length), looks ahead for the nearest
 * later word that would NOT violate either rule against the current previous word
 * and swaps it into place. If no such candidate exists (e.g. too little variety
 * left near the end of the queue), the original order is left as-is rather than
 * dropping words — a queue with an occasional repeat beats a shorter queue.
 */
function repairAdjacency(sequence: VocabWord[]): VocabWord[] {
  const out = sequence.slice();

  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    let cur = out[i];

    let sameLevelRun = 1;
    for (let k = i - 1; k > 0 && out[k].cefrLevel === out[k - 1].cefrLevel; k--) sameLevelRun++;

    const violatesPos = primaryPos(cur) === primaryPos(prev);
    const violatesLevel = cur.cefrLevel === prev.cefrLevel && sameLevelRun >= MAX_CONSECUTIVE_SAME_CEFR;

    if (!violatesPos && !violatesLevel) continue;

    for (let j = i + 1; j < out.length; j++) {
      const candidate = out[j];
      const candidateOkPos = primaryPos(candidate) !== primaryPos(prev);
      const candidateOkLevel = !(candidate.cefrLevel === prev.cefrLevel && sameLevelRun >= MAX_CONSECUTIVE_SAME_CEFR);
      if (candidateOkPos && candidateOkLevel) {
        out[i] = candidate;
        out[j] = cur;
        cur = candidate;
        break;
      }
    }
  }

  return out;
}

/** Builds the ordered word-ID list for a lesson. See module doc comment above. */
export function getStudyQueue({ mode, oxford5000Scope, sessionSize, reviewStrategy, date, words }: GetStudyQueueArgs): string[] {
  const pool = getPool(mode, oxford5000Scope, words);
  const tiers = buildPriorityTiers(pool, date);

  const seed = hashStringToSeed(`${dateKey(date)}|${mode}|${oxford5000Scope}|${reviewStrategy}`);
  const rng = mulberry32(seed);
  const shuffledTiers = tiers.map((tier) => seededShuffle(tier, rng));

  let sequence: VocabWord[];

  if (reviewStrategy === 'ALPHABETICAL') {
    // Ignore priority entirely; still limited to the same "needs practice" pool.
    sequence = shuffledTiers.flat().sort((a, b) => a.word.localeCompare(b.word));
  } else if (reviewStrategy === 'REVIEW_FIRST') {
    sequence = [...shuffledTiers[0], ...weightedInterleave(shuffledTiers.slice(1), MIXED_TIER_WEIGHTS.slice(1))];
  } else if (reviewStrategy === 'NEW_FIRST') {
    const rest = [shuffledTiers[0], shuffledTiers[1], shuffledTiers[3], shuffledTiers[4]];
    const restWeights = [MIXED_TIER_WEIGHTS[0], MIXED_TIER_WEIGHTS[1], MIXED_TIER_WEIGHTS[3], MIXED_TIER_WEIGHTS[4]];
    sequence = [...shuffledTiers[2], ...weightedInterleave(rest, restWeights)];
  } else if (reviewStrategy === 'DIFFICULT_FIRST') {
    const rest = [shuffledTiers[0], shuffledTiers[2], shuffledTiers[3], shuffledTiers[4]];
    const restWeights = [MIXED_TIER_WEIGHTS[0], MIXED_TIER_WEIGHTS[2], MIXED_TIER_WEIGHTS[3], MIXED_TIER_WEIGHTS[4]];
    sequence = [...shuffledTiers[1], ...weightedInterleave(rest, restWeights)];
  } else {
    // MIXED (default): all tiers interleaved by priority weight.
    sequence = weightedInterleave(shuffledTiers, MIXED_TIER_WEIGHTS);
  }

  const repaired = reviewStrategy === 'ALPHABETICAL' ? sequence : repairAdjacency(sequence);
  return repaired.slice(0, sessionSize).map((w) => w.id);
}
