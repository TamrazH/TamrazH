// Downloads one illustration per vocabulary word from Pixabay (Pixabay Content
// License: free to use, no attribution required) into public/images/words/<id>.webp
// and records the path as `imageUrl` in public/data/vocabulary.json.
//
// Usage:
//   PIXABAY_API_KEY=... node scripts/fetch-pixabay-images.mjs [--limit N] [--level A1] [--redo id1,id2] [--dry-run]
//
// Resumable: words that already have an image file are skipped, and the dataset is
// saved every 25 words. A word only gets an image if a result's tags contain the
// word, so unclear words stay empty rather than getting a wrong picture; those are
// listed in scripts/image-report.md. Per-word query fixes go in scripts/image-queries.json
// ({ "<word id>": "better search terms" }, or "" for no image) — then rerun with --redo <id>.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const APP = new URL('..', import.meta.url).pathname;
const VOCAB = path.join(APP, 'public/data/vocabulary.json');
const IMG_DIR = path.join(APP, 'public/images/words');
const QUERIES = path.join(APP, 'scripts/image-queries.json');
const REPORT = path.join(APP, 'scripts/image-report.md');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = args.includes('--dry-run');
const LIMIT = Number(flag('--limit') ?? Infinity);
const LEVEL = flag('--level');
const REDO = new Set((flag('--redo') ?? '').split(',').filter(Boolean));
const KEY = process.env.PIXABAY_API_KEY;
if (!KEY && !DRY) {
  console.error('PIXABAY_API_KEY is not set');
  process.exit(1);
}

// Grammar words have no picturable meaning; they are left without an image on purpose.
const NO_IMAGE_POS = /^(indefinite article|definite article|prep\.|conj\.|det\.|pron\.|auxiliary v\.|modal v\.|infinitive marker)/;
const STOP = new Set(['sb', 'sth', 'a', 'an', 'the', 'of', 'to', 'from', 'in', 'on', 'for', 'into', 'not', 'with']);

const overrides = fs.existsSync(QUERIES) ? JSON.parse(fs.readFileSync(QUERIES, 'utf8')) : {};

function baseWord(headword) {
  return headword.replace(/\s*\(.*\)$/, '').replace(/\d+$/, '').split(',')[0].trim();
}

/**
 * Search terms to try in order. A hand-written override is used alone. A word with a
 * sense label ("bank (river)") is searched with that label only — falling back to the
 * bare word would risk the other sense's picture.
 */
function queriesFor(w) {
  if (overrides[w.id]) return [overrides[w.id]];
  const base = baseWord(w.word);
  const label = w.word.match(/\((.*)\)$/)?.[1];
  const hint = label
    ?.split(/[\s/]+/)
    .filter((t) => !STOP.has(t.toLowerCase()))
    .slice(0, 2)
    .join(' ');
  return hint ? [`${base} ${hint}`] : [base];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
async function pixabaySearch(q) {
  // Pixabay allows 100 requests per 60 seconds per key.
  const wait = lastCall + 650 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const url = new URL('https://pixabay.com/api/');
  url.search = new URLSearchParams({
    key: KEY,
    q,
    lang: 'en',
    image_type: 'photo',
    safesearch: 'true',
    order: 'popular',
    per_page: '20',
  }).toString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(15000);
      continue;
    }
    if (!res.ok) throw new Error(`Pixabay ${res.status} for "${q}": ${await res.text()}`);
    return (await res.json()).hits ?? [];
  }
  throw new Error(`Pixabay kept rate-limiting "${q}"`);
}

/** First hit whose tags mention the word (or its first token for phrases). */
function pickHit(hits, word) {
  const needle = word.toLowerCase().split(/[\s-]+/)[0];
  return hits.find((h) => h.tags.toLowerCase().split(/,\s*/).some((tag) => tag.includes(needle)));
}

async function download(hit, id) {
  const res = await fetch(hit.webformatURL);
  if (!res.ok) throw new Error(`image ${res.status} for ${id}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(IMG_DIR, `${id}.webp`);
  await sharp(buf).resize(400, 300, { fit: 'cover', position: 'attention' }).webp({ quality: 62 }).toFile(out);
  return `images/words/${id}.webp`;
}

const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
fs.mkdirSync(IMG_DIR, { recursive: true });
const save = () => fs.writeFileSync(VOCAB, JSON.stringify(vocab));

const noMatch = [];
const skippedPos = [];
const failed = [];
let processed = 0;
let added = 0;

for (const w of vocab) {
  if (processed >= LIMIT) break;
  if (LEVEL && w.cefrLevel !== LEVEL) continue;
  if (REDO.size && !REDO.has(w.id)) continue;
  if (!REDO.has(w.id) && w.imageUrl && fs.existsSync(path.join(APP, 'public', w.imageUrl))) continue;
  if (overrides[w.id] === '' || (NO_IMAGE_POS.test(w.partOfSpeech) && !overrides[w.id])) {
    skippedPos.push(w.word);
    if (!('imageUrl' in w)) w.imageUrl = null;
    continue;
  }
  processed++;
  const queries = queriesFor(w);
  if (DRY) {
    console.log(w.id.padEnd(32), JSON.stringify(queries));
    continue;
  }
  try {
    let hit;
    for (const q of queries) {
      const hits = await pixabaySearch(q);
      // a hand-written query is trusted as is; automatic ones must match the word's tags
      hit = overrides[w.id] ? hits[0] : pickHit(hits, baseWord(w.word));
      if (hit) break;
    }
    if (hit) {
      w.imageUrl = await download(hit, w.id);
      added++;
    } else {
      w.imageUrl = null;
      noMatch.push(`${w.word} (${w.id}) — searched: ${queries.join(' | ')}`);
    }
  } catch (e) {
    failed.push(`${w.id}: ${e.message}`);
  }
  if (processed % 25 === 0) {
    save();
    console.log(`${processed} processed, ${added} images, ${noMatch.length} no match, ${failed.length} failed`);
  }
}

if (!DRY) {
  save();
  const withImage = vocab.filter((w) => w.imageUrl).length;
  fs.writeFileSync(
    REPORT,
    [
      '# Word image report',
      '',
      `Words with an image: ${withImage} / ${vocab.length}`,
      '',
      `## No matching image this run (${noMatch.length})`,
      'Add a better search term to scripts/image-queries.json and rerun with `--redo <id>`.',
      '',
      ...noMatch.map((x) => `- ${x}`),
      '',
      `## Left without an image on purpose: grammar words and unpicturable senses (${skippedPos.length})`,
      '',
      skippedPos.join(', '),
      '',
      `## Errors (${failed.length})`,
      '',
      ...failed.map((x) => `- ${x}`),
      '',
    ].join('\n'),
  );
  console.log(`done: ${processed} processed, ${added} images added, ${noMatch.length} no match, ${failed.length} failed`);
}
