// Fills in word images from Wikimedia Commons for words that have none, using
// Wikidata to find a picture of the word's actual meaning rather than a keyword
// match. Images are openly licensed (mostly CC BY / CC BY-SA), so each one's
// author, license and source page are stored as `imageCredit` and shown in the app.
//
// Lookup, most precise first:
//   1. lexeme: English Wikidata lexeme for the headword with the same part of speech;
//      the sense whose gloss best matches our definition; that sense's image (P18) or
//      the image of the item the sense stands for (P5137 -> P18).
//   2. item (nouns only): a Wikidata item whose English label is exactly the headword
//      and which has an image, skipping names, works, places and taxa-like noise.
//
// Usage:
//   node scripts/fetch-wikimedia-images.mjs [--sample N] [--ids a,b] [--limit N] [--dry-run]
// --sample N picks N candidate words pseudo-randomly (fixed seed) for a pilot.
// No API key is needed. Words pinned in image-queries.json are candidates too: that pin
// only stops the keyword-based Pixabay script, and this lookup is meaning-based.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const APP = new URL('..', import.meta.url).pathname;
const VOCAB = path.join(APP, 'public/data/vocabulary.json');
const IMG_DIR = path.join(APP, 'public/images/words');
const LOG = path.join(APP, 'scripts/wikimedia-log.json');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = args.includes('--dry-run');
const SAMPLE = flag('--sample') ? Number(flag('--sample')) : null;
const LIMIT = Number(flag('--limit') ?? Infinity);
const IDS = new Set((flag('--ids') ?? '').split(',').filter(Boolean));

const UA = 'OxfordSozApp/1.0 (vocabulary learning PWA; https://github.com/TamrazH/TamrazH) node-fetch';
const WD = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

const NO_IMAGE_POS = /^(indefinite article|definite article|prep\.|conj\.|det\.|pron\.|auxiliary v\.|modal v\.|infinitive marker|exclam\.|number)/;
const LEXICAL_CATEGORY = { 'n.': 'Q1084', 'v.': 'Q24905', 'adj.': 'Q34698', 'adv.': 'Q380057' };
const ENGLISH = 'Q1860';
// item descriptions that mean "not the everyday thing": names, works, places, organisations
const ITEM_NOISE =
  /\b(family name|given name|surname|film|album|song|single|band|novel|book|magazine|newspaper|television|tv series|episode|video game|company|brand|software|village|town|city|commune|municipality|river|mountain|lake|island|county|district|station|ship|genus|species of|asteroid|painting by|sculpture by|disambiguation|wikimedia|journal|character|politician|footballer|musician|actor|actress|album by|record label|organization|organisation|airport|school in|church in|building in|street in)\b/i;
const STOP = new Set('a an the of to in on for and or with by from as at is be that this which who something someone sb sth used very'.split(' '));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function api(base, params) {
  const wait = last + 120 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const url = new URL(base);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params }).toString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${base} ${res.status}`);
    const json = await res.json();
    if (json.error?.code === 'maxlag') {
      await sleep(5000);
      continue;
    }
    if (json.error) throw new Error(`${base}: ${json.error.code} ${json.error.info}`);
    return json;
  }
  throw new Error(`${base}: gave up after retries`);
}

function baseWord(headword) {
  return headword.replace(/\s*\(.*\)$/, '').replace(/\d+$/, '').split(',')[0].trim();
}
const words = (s) =>
  new Set(
    (s ?? '')
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
function overlap(a, b) {
  const A = words(a);
  let n = 0;
  for (const t of words(b)) if (A.has(t)) n++;
  return n;
}
const claimIds = (entity, prop) => (entity.claims?.[prop] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);

async function getEntities(ids) {
  if (!ids.length) return {};
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const json = await api(WD, { action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props: 'labels|descriptions|claims', languages: 'en' });
    Object.assign(out, json.entities);
  }
  return out;
}

/** Route 1: lexeme sense -> image. Returns { file, method, detail } or null. */
async function viaLexeme(w) {
  const lemma = baseWord(w.word);
  const category = LEXICAL_CATEGORY[w.partOfSpeech.split(/[,/;]/)[0].trim()];
  if (!category) return null;
  const search = await api(WD, { action: 'wbsearchentities', search: lemma, language: 'en', type: 'lexeme', limit: '10' });
  const lexIds = (search.search ?? []).map((r) => r.id);
  if (!lexIds.length) return null;
  const json = await api(WD, { action: 'wbgetentities', ids: lexIds.join('|') });
  const lexemes = Object.values(json.entities).filter(
    (l) => l.language === ENGLISH && l.lexicalCategory === category && Object.values(l.lemmas ?? {}).some((x) => x.value.toLowerCase() === lemma.toLowerCase()),
  );
  const senses = lexemes.flatMap((l) => l.senses ?? []);
  if (!senses.length) return null;

  const scored = senses.map((s) => ({
    sense: s,
    gloss: s.glosses?.en?.value ?? '',
    score: overlap(s.glosses?.en?.value, `${w.englishDefinition} ${w.exampleSentence} ${w.word}`),
    image: claimIds(s, 'P18')[0],
    items: claimIds(s, 'P5137').map((v) => v.id),
  }));
  // a word with several senses must match on the gloss; a single sense is taken as is
  const usable = scored.filter((s) => s.image || s.items.length);
  if (!usable.length) return null;
  usable.sort((a, b) => b.score - a.score);
  const best = usable[0];
  if (senses.length > 1 && best.score === 0) return null;

  if (best.image) return { file: best.image, method: 'lexeme-sense', detail: best.gloss };
  const items = await getEntities(best.items);
  for (const id of best.items) {
    const file = claimIds(items[id] ?? {}, 'P18')[0];
    if (file) return { file, method: 'lexeme-item', detail: `${best.gloss} -> ${id} ${items[id].labels?.en?.value ?? ''}` };
  }
  return null;
}

/** Route 2 (nouns only): exact-label item with an image. */
async function viaItem(w) {
  if (!/^n\./.test(w.partOfSpeech)) return null;
  const lemma = baseWord(w.word);
  const search = await api(WD, { action: 'wbsearchentities', search: lemma, language: 'en', type: 'item', limit: '10' });
  const exact = (search.search ?? []).filter(
    (r) => (r.label ?? '').toLowerCase() === lemma.toLowerCase() && !ITEM_NOISE.test(r.description ?? ''),
  );
  if (!exact.length) return null;
  const items = await getEntities(exact.map((r) => r.id));
  const candidates = exact
    .map((r) => ({ r, file: claimIds(items[r.id] ?? {}, 'P18')[0] }))
    .filter((c) => c.file)
    // prefer the item whose description shares words with our definition
    .map((c) => ({ ...c, score: overlap(c.r.description, w.englishDefinition) }))
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const best = candidates[0];
  if (exact.length > 1 && best.score === 0) return null;
  return { file: best.file, method: 'item', detail: `${best.r.id} ${best.r.description ?? ''}` };
}

const stripHtml = (s) =>
  (s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

async function commonsInfo(file) {
  const json = await api(COMMONS, {
    action: 'query',
    titles: `File:${file}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '800',
  });
  const info = json.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value) || 'see source';
  const author = stripHtml(meta.Artist?.value).slice(0, 60) || 'Wikimedia Commons';
  if (/fair use|non-free/i.test(license)) return null;
  return { url: info.thumburl ?? info.url, mime: info.mime, credit: { author, license, source: info.descriptionurl } };
}

async function download(url, id) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).resize(400, 300, { fit: 'cover', position: 'attention' }).webp({ quality: 62 }).toFile(path.join(IMG_DIR, `${id}.webp`));
  return `images/words/${id}.webp`;
}

// ---------- main ----------
const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
let candidates = vocab.filter((w) => !w.imageUrl && !NO_IMAGE_POS.test(w.partOfSpeech));
if (IDS.size) candidates = vocab.filter((w) => IDS.has(w.id));
if (SAMPLE) {
  let s = 20261116;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  candidates = candidates
    .map((w) => [rnd(), w])
    .sort((a, b) => a[0] - b[0])
    .slice(0, SAMPLE)
    .map(([, w]) => w);
}
candidates = candidates.slice(0, LIMIT);
fs.mkdirSync(IMG_DIR, { recursive: true });

const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : {};
const save = () => {
  fs.writeFileSync(VOCAB, JSON.stringify(vocab));
  fs.writeFileSync(LOG, JSON.stringify(log, null, 1) + '\n');
};
const counts = { 'lexeme-sense': 0, 'lexeme-item': 0, item: 0, none: 0, error: 0 };

for (const [n, w] of candidates.entries()) {
  try {
    const hit = (await viaLexeme(w)) ?? (await viaItem(w));
    if (!hit) {
      counts.none++;
      log[w.id] = { result: 'none' };
    } else {
      const info = await commonsInfo(hit.file);
      if (!info || !/^image\/(jpeg|png|webp|gif|tiff)/.test(info.mime)) {
        counts.none++;
        log[w.id] = { result: 'none', reason: `unusable file ${hit.file}` };
      } else if (DRY) {
        counts[hit.method]++;
        log[w.id] = { result: hit.method, file: hit.file, detail: hit.detail };
      } else {
        w.imageUrl = await download(info.url, w.id);
        w.imageCredit = info.credit;
        counts[hit.method]++;
        log[w.id] = { result: hit.method, file: hit.file, detail: hit.detail };
      }
    }
  } catch (e) {
    counts.error++;
    log[w.id] = { result: 'error', reason: e.message };
  }
  if ((n + 1) % 25 === 0) {
    save();
    console.log(`${n + 1}/${candidates.length}`, JSON.stringify(counts));
  }
}
save();
console.log('done', candidates.length, JSON.stringify(counts));
