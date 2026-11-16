// Splits every word that still has no picture into numbered 25-word batches (C1 first) and writes
// a ready-to-paste ChatGPT prompt for each one.
//   scripts/ai-batches.json  — batch number -> word ids (cell order), used when importing
//   scripts/AI-PROMPTS.md    — the prompts to copy into ChatGPT, one per batch
// Batches already in ai-batches.json are kept as they are; only new words get new batches.
// Import a returned image with:
//   node scripts/import-ai-grid.mjs <image> 5 5 --batch <N> [--skip id,id]
//
// Usage: node scripts/make-ai-prompts.mjs
import fs from 'node:fs';
import path from 'node:path';

const APP = new URL('..', import.meta.url).pathname;
const BATCHES = path.join(APP, 'scripts/ai-batches.json');
const PROMPTS = path.join(APP, 'scripts/AI-PROMPTS.md');
const PER_BATCH = 25;
const FIRST_NEW_BATCH = 3; // batches 1 and 2 were the 16- and 25-word trials

const GRAMMAR = /^(indefinite article|definite article|prep\.|conj\.|det\.|pron\.|auxiliary v\.|modal v\.|infinitive marker|exclam\.|number)/;
// Adverbs a single picture can show; all other adverbs (however, therefore, quite...) are left out.
const DRAWABLE_ADVERBS = new Set(
  'abroad ahead alike apart away backward badly below everywhere halfway happily heavily here indoors outside overnight quickly quietly sadly slowly suddenly there today tonight twice upstairs yesterday'.split(' '),
);
// Words whose picture would equally fit another word (aunt vs mother), or that look identical (weekdays).
const SKIP = new Set(
  'aunt-a1 uncle-a1 tuesday-a1 wednesday-a1 thursday-a1 friday-a1'.split(' '),
);

// Violent, sexual or otherwise sensitive words: an image generator may refuse the whole
// grid because of one of them, and a cartoon would not suit them anyway.
const SENSITIVE = new Set(
  'abortion abuse assassination casualty execute execution lesbian massacre rape sexuality slavery suicide torture kill killing murder sex sexual slave victim violent bombing breast naked racist sexy terror terrorism terrorist violence'.split(' '),
);

const vocab = JSON.parse(fs.readFileSync(path.join(APP, 'public/data/vocabulary.json'), 'utf8'));
const batches = fs.existsSync(BATCHES) ? JSON.parse(fs.readFileSync(BATCHES, 'utf8')) : {};
const planned = new Set(Object.values(batches).flat());

const headword = (w) => w.word.replace(/\d+(?=\s*(\(|$))/, '').trim();
const isAdverb = (w) => /^adv/.test(w.partOfSpeech);
// C1 first: the hardest words to remember and the level with the fewest pictures
const LEVELS = ['C1', 'A1', 'A2', 'B1', 'B2'];
const candidates = vocab
  .filter((w) => !w.imageUrl && !planned.has(w.id) && !SKIP.has(w.id.toLowerCase()) && !GRAMMAR.test(w.partOfSpeech))
  .filter((w) => !isAdverb(w) || DRAWABLE_ADVERBS.has(headword(w).toLowerCase()))
  .filter((w) => !SENSITIVE.has(headword(w).toLowerCase()))
  .sort((a, b) => LEVELS.indexOf(a.cefrLevel) - LEVELS.indexOf(b.cefrLevel) || a.word.localeCompare(b.word));

let next = Math.max(FIRST_NEW_BATCH - 1, ...Object.keys(batches).map(Number)) + 1;
for (let i = 0; i < candidates.length; i += PER_BATCH) {
  batches[next++] = candidates.slice(i, i + PER_BATCH).map((w) => w.id);
}
fs.writeFileSync(BATCHES, JSON.stringify(batches, null, 1) + '\n');

const byId = Object.fromEntries(vocab.map((w) => [w.id, w]));
const meaning = (w) => (w.englishDefinition ?? '').replace(/\.$/, '').replace(/^./, (c) => c.toLowerCase());
const gridFor = (n) => (n === PER_BATCH ? [5, 5] : [Math.ceil(n / 5), 5]);

const out = [
  '# ChatGPT prompts for word illustrations',
  '',
  'Paste one prompt into a **new ChatGPT chat**, then send the image back with its batch number.',
  '',
];
for (const [num, ids] of Object.entries(batches)) {
  if (Number(num) < FIRST_NEW_BATCH) continue;
  const todo = ids.filter((id) => !byId[id]?.imageUrl);
  if (!todo.length) continue;
  const [rows, cols] = gridFor(ids.length);
  out.push(
    `## Batch ${num}`,
    '',
    '```',
    `Create ONE image in landscape 3:2 format: a grid of ${cols} columns × ${rows} rows = ${rows * cols} equal cells, separated by thin white gutters.`,
    '',
    'Each cell is a small illustration that explains ONE English word to a language learner, so the meaning must be obvious at a glance.',
    '',
    `Style for all cells (keep it identical everywhere):`,
    '- cute cartoon style with bold dark outlines and flat colours',
    '- friendly characters (children and adults with simple faces, brown hair)',
    '- one soft pastel background colour per cell',
    '- the subject centred and large, filling most of the cell',
    '- absolutely NO text, letters, numbers or labels anywhere in the image',
    ...(ids.length < rows * cols ? [`- leave the last ${rows * cols - ids.length} cell(s) as plain pastel background`] : []),
    '',
    'Fill the cells left to right, top to bottom, in exactly this order:',
    ...ids.map((id, i) => `${i + 1}. ${headword(byId[id]).replace(/\s*\(.*\)$/, '')} — ${meaning(byId[id])}`),
    '```',
    '',
  );
}
fs.writeFileSync(PROMPTS, out.join('\n'));
const counts = Object.entries(batches).filter(([n]) => Number(n) >= FIRST_NEW_BATCH);
console.log(`${counts.length} batches (${FIRST_NEW_BATCH}..${next - 1}), ${counts.reduce((s, [, ids]) => s + ids.length, 0)} words`);
