// Adds IPA transcriptions to public/data/vocabulary.json.
//   American (`pronunciation`):  CMUdict (BSD), ARPAbet converted to Oxford-learner-style IPA.
//   British  (`pronunciationUk`): open-dict-data/ipa-dict en_UK (MIT), symbols normalized.
//
// Usage:
//   curl -sSO https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict
//   curl -sSO https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_UK.txt
//   node scripts/add-ipa.mjs cmudict.dict en_UK.txt
import fs from 'node:fs';

const [cmuPath, ukPath] = process.argv.slice(2);
if (!cmuPath || !ukPath) {
  console.error('usage: node scripts/add-ipa.mjs <cmudict.dict> <en_UK.txt>');
  process.exit(1);
}
const VOCAB = new URL('../public/data/vocabulary.json', import.meta.url);

// Heteronyms whose sound (not just stress) depends on meaning: [US, UK].
const OVERRIDES = {
  'a, an': ['ə, ən', 'ə, ən'],
  close1: ['kloʊz', 'kləʊz'],
  close2: ['kloʊs', 'kləʊs'],
  content1: ['ˈkɑːntent', 'ˈkɒntent'],
  content2: ['kənˈtent', 'kənˈtent'],
  lead1: ['liːd', 'liːd'],
  live1: ['lɪv', 'lɪv'],
  live2: ['laɪv', 'laɪv'],
  minute1: ['ˈmɪnɪt', 'ˈmɪnɪt'],
  minute2: ['maɪˈnuːt', 'maɪˈnjuːt'],
  refuse1: ['rɪˈfjuːz', 'rɪˈfjuːz'],
  row1: ['roʊ', 'rəʊ'],
  tear1: ['ter', 'teə(r)'],
  tear2: ['tɪr', 'tɪə(r)'],
  wind1: ['wɪnd', 'wɪnd'],
  wind2: ['waɪnd', 'waɪnd'],
  bass1: ['beɪs', 'beɪs'],
  bow1: ['baʊ', 'baʊ'],
  used1: ['juːzd', 'juːzd'],
  used2: ['juːst', 'juːst'],
  'used to': ['ˈjuːst tə', 'ˈjuːst tə'],
  'have to': ['ˈhæf tə', 'ˈhæf tə'],
  recount1: ['rɪˈkaʊnt', 'rɪˈkaʊnt'],
  use: { n: ['juːs', 'juːs'], v: ['juːz', 'juːz'] },
  excuse: { n: ['ɪkˈskjuːs', 'ɪkˈskjuːs'], v: ['ɪkˈskjuːz', 'ɪkˈskjuːz'] },
  abuse: { n: ['əˈbjuːs', 'əˈbjuːs'], v: ['əˈbjuːz', 'əˈbjuːz'] },
  house: { n: ['haʊs', 'haʊs'], v: ['haʊz', 'haʊz'] },
  read: ['riːd', 'riːd'],
  résumé: ['ˈrezəmeɪ', 'ˈrezjumeɪ'],
  resume: ['rɪˈzuːm', 'rɪˈzjuːm'],
  afternoon: ['ˌæftərˈnuːn', 'ˌɑːftəˈnuːn'],
  path: ['pæθ', 'pɑːθ'],
  'according to': ['əˈkɔːrdɪŋ tə', 'əˈkɔːdɪŋ tə'],
  'all right': ['ˌɔːl ˈraɪt', 'ˌɔːl ˈraɪt'],
  'ice cream': ['ˌaɪs ˈkriːm', 'ˌaɪs ˈkriːm'],
  'next to': ['ˈnekst tə', 'ˈnekst tə'],
  'no one': ['ˈnoʊ wʌn', 'ˈnəʊ wʌn'],
};

/**
 * Learner-dictionary convention: secondary stress is only written before the
 * primary stress, and not on a short lax prefix syllable (ɪmˈpɔːrtənt, not ˌɪmˈpɔːrtənt).
 */
function tidyStress(ipa) {
  return ipa
    .split(' ')
    .map((raw) => {
      const lastPrimary = raw.lastIndexOf('ˈ');
      const word = raw.slice(0, lastPrimary).replace(/ˈ/g, 'ˌ') + raw.slice(lastPrimary);
      const primary = word.indexOf('ˈ');
      if (primary < 0) return word;
      const head = word.slice(0, primary).replace(/^ˌ([^aeiouæɑɒɔəɜɪʊʌ]*[ɪəe][^aeiouæɑɒɔəɜɪʊʌː]*)$/u, '$1');
      return head + 'ˈ' + word.slice(primary + 1).replace(/ˌ/g, '');
    })
    .join(' ');
}

// ---------- American: CMUdict ----------
const cmu = new Map();
for (const line of fs.readFileSync(cmuPath, 'utf8').split('\n')) {
  const m = line.match(/^([^\s(]+)(?:\(\d+\))?\s+([^#]+)/);
  if (!m) continue;
  const key = m[1].toLowerCase();
  if (!cmu.has(key)) cmu.set(key, []);
  cmu.get(key).push(m[2].trim().split(/\s+/));
}

const VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'ERX', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW']);
const ONSETS = new Set(
  [
    'P L', 'B L', 'K L', 'G L', 'F L', 'S L', 'P R', 'B R', 'T R', 'D R', 'K R', 'G R', 'F R', 'TH R', 'SH R',
    'T W', 'D W', 'K W', 'G W', 'S W', 'TH W', 'P Y', 'B Y', 'K Y', 'G Y', 'F Y', 'V Y', 'M Y', 'HH Y',
    'S P', 'S T', 'S K', 'S M', 'S N', 'S F', 'S P L', 'S P R', 'S T R', 'S K R', 'S K W', 'S K Y', 'S P Y', 'S K L',
  ],
);
const isLegalOnset = (cons) => cons.length <= 1 ? cons[0] !== 'NG' : ONSETS.has(cons.join(' '));

const CONS_IPA = {
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ',
  P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};
function vowelIpa(base, stress) {
  const stressed = stress !== '0';
  switch (base) {
    case 'AA': return 'ɑː';
    case 'AE': return 'æ';
    case 'AH': return stressed ? 'ʌ' : 'ə';
    case 'AO': return 'ɔː';
    case 'AW': return 'aʊ';
    case 'AY': return 'aɪ';
    case 'EH': return 'e';
    case 'ER': return stressed ? 'ɜːr' : 'ər';
    case 'ERX': return 'ɜː';
    case 'EY': return 'eɪ';
    case 'IH': return 'ɪ';
    case 'IY': return stressed ? 'iː' : 'i';
    case 'OW': return 'oʊ';
    case 'OY': return 'ɔɪ';
    case 'UH': return 'ʊ';
    case 'UW': return stressed ? 'uː' : 'u';
  }
  throw new Error('unknown vowel ' + base);
}

/** ARPAbet phones -> IPA with stress marks placed before the stressed syllable's onset. */
function arpabetToIpa(rawPhones) {
  const phones = [];
  rawPhones.forEach((p, i) => {
    const m = p.match(/^ER([012])$/);
    const next = rawPhones[i + 1]?.match(/^([A-Z]+)[012]$/);
    if (m && next && VOWELS.has(next[1])) phones.push(m[1] === '0' ? 'AH0' : 'ERX' + m[1], 'R');
    else phones.push(p);
  });
  const marks = new Array(phones.length).fill('');
  let prevVowel = -1;
  phones.forEach((p, i) => {
    const m = p.match(/^([A-Z]+)([012])$/);
    if (!m || !VOWELS.has(m[1])) return;
    let onsetStart = i;
    while (onsetStart - 1 > prevVowel && isLegalOnset(phones.slice(onsetStart - 1, i))) onsetStart--;
    if (m[2] === '1') marks[onsetStart] += 'ˈ';
    if (m[2] === '2') marks[onsetStart] += 'ˌ';
    prevVowel = i;
  });
  const syllableCount = phones.filter((p) => /\d$/.test(p)).length;
  let out = '';
  phones.forEach((p, i) => {
    const m = p.match(/^([A-Z]+)([012])$/);
    // a lone primary stress on a one-syllable word is not written
    const mark = syllableCount === 1 ? '' : marks[i];
    out += mark + (m ? vowelIpa(m[1], m[2]) : CONS_IPA[p]);
  });
  return syllabicConsonants(out);
}

/** Oxford convention: final "-əl"/"-ən" after a consonant are written as syllabic /l/ /n/. */
function syllabicConsonants(ipa) {
  return ipa
    .replace(/([pbtdkɡfvθðszʃʒmnŋ])əl$/u, '$1l')
    .replace(/([ʃʒ])ən$/u, '$1n');
}

const primaryStressSyllable = (phones) => phones.filter((p) => /\d$/.test(p)).findIndex((p) => p.endsWith('1'));

/** Pick the CMUdict variant that fits the entry's part of speech (REcord n. vs reCORD v., estimate n. vs v.). */
function pickVariant(variants, pos) {
  if (variants.length === 1) return variants[0];
  const firstPos = pos.split(/[,/;]\s*/)[0].trim();
  const isVerb = firstPos === 'v.';
  const isNounish = firstPos === 'n.' || firstPos === 'adj.';
  if (!isVerb && !isNounish) return variants[0];
  const endsEyT = (v) => v.at(-2)?.startsWith('EY') && v.at(-1) === 'T';
  if (variants.some(endsEyT) && variants.some((v) => !endsEyT(v))) {
    return variants.find((v) => (isVerb ? endsEyT(v) : !endsEyT(v)));
  }
  const stressIdx = variants.map(primaryStressSyllable);
  if (new Set(stressIdx).size > 1) {
    const target = isVerb ? Math.max(...stressIdx) : Math.min(...stressIdx);
    return variants[stressIdx.indexOf(target)];
  }
  return variants[0];
}

// ---------- British: ipa-dict en_UK ----------
const uk = new Map();
for (const line of fs.readFileSync(ukPath, 'utf8').split('\n')) {
  const [w, ipas] = line.split('\t');
  if (!w || !ipas) continue;
  uk.set(w.toLowerCase(), ipas.split(',').map((s) => s.trim().replace(/^\/|\/$/g, '')));
}

const UK_CONS = ['tʃ', 'dʒ', 'p', 'b', 't', 'd', 'k', 'ɡ', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j'];
const UK_ONSETS = new Set([
  'pl', 'bl', 'kl', 'ɡl', 'fl', 'sl', 'pr', 'br', 'tr', 'dr', 'kr', 'ɡr', 'fr', 'θr', 'ʃr', 'tw', 'dw', 'kw', 'ɡw', 'sw', 'θw',
  'pj', 'bj', 'tj', 'dj', 'kj', 'ɡj', 'fj', 'vj', 'mj', 'nj', 'lj', 'hj', 'sj', 'zj', 'θj',
  'sp', 'st', 'sk', 'sm', 'sn', 'sf', 'spl', 'spr', 'str', 'skr', 'skw', 'skj', 'spj', 'stj', 'skl',
]);

/** Splits an IPA string into consonant tokens / other characters. */
function tokenize(ipa) {
  const out = [];
  for (let i = 0; i < ipa.length; ) {
    const c = UK_CONS.find((k) => ipa.startsWith(k, i));
    if (c) { out.push({ t: c, cons: true }); i += c.length; } else { out.push({ t: ipa[i], cons: false }); i += 1; }
  }
  return out;
}

/** espeak-style UK IPA puts the stress mark right before the vowel; move it to the start of the syllable onset. */
function normalizeUk(raw) {
  const s = raw.replace(/ɹ/g, 'r').replace(/ɐ/g, 'ə').replace(/ɛ/g, 'e').replace(/ɫ/g, 'l').replace(/iə/g, 'ɪə').replace(/g/g, 'ɡ');
  const toks = tokenize(s);
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].t !== 'ˈ' && toks[i].t !== 'ˌ') continue;
    let j = i;
    while (j - 1 >= 0 && toks[j - 1].cons) {
      const onset = toks.slice(j - 1, i).map((x) => x.t).join('');
      if (i - (j - 1) > 1 && !UK_ONSETS.has(onset)) break;
      j--;
    }
    // keep at least one consonant in the coda when the cluster is longer than a legal onset
    if (j < i) {
      const [mark] = toks.splice(i, 1);
      toks.splice(j, 0, mark);
    }
  }
  let out = toks.map((x) => x.t).join('');
  const vowelGroups = out.match(/[aeiouæɑɒɔəɜɪʊʌ]+ː?/gu) ?? [];
  if (vowelGroups.length <= 1) out = out.replace(/ˈ/g, '');
  return syllabicConsonants(out);
}

const ukStressSyllable = (ipa) => {
  const before = ipa.split('ˈ')[0];
  return (before.match(/[aeiouæɑɒɔəɜɪʊʌ]+ː?/gu) ?? []).length;
};

// ---------- lookup ----------
function headwordForms(word) {
  return word
    .replace(/\s*\(.*\)$/, '')
    .replace(/\d+$/, '')
    .replace(/’/g, "'")
    .split(/,\s*/)
    .map((s) => s.trim().toLowerCase());
}

function lookupUs(form, pos) {
  const whole = cmu.get(form);
  if (whole) return { ipa: arpabetToIpa(pickVariant(whole, pos)), stressIdx: primaryStressSyllable(pickVariant(whole, pos)) };
  const parts = form.split(/[\s-]+/);
  if (parts.length === 1) return null;
  const ipas = parts.map((p) => cmu.get(p));
  if (ipas.some((x) => !x)) return null;
  return { ipa: ipas.map((v) => arpabetToIpa(v[0])).join(' '), stressIdx: -1 };
}

function lookupUk(form, usStressIdx) {
  const whole = uk.get(form);
  if (whole) {
    const normalized = whole.map(normalizeUk);
    const match = usStressIdx >= 0 ? normalized.find((v) => ukStressSyllable(v) === usStressIdx) : undefined;
    return match ?? normalized[0];
  }
  const parts = form.split(/[\s-]+/);
  if (parts.length === 1) return null;
  const ipas = parts.map((p) => uk.get(p));
  if (ipas.some((x) => !x)) return null;
  return ipas.map((v) => normalizeUk(v[0])).join(' ');
}

const UK_SPELLINGS = [
  [/^aluminum$/, 'aluminium'],
  [/^skeptical$/, 'sceptical'],
  [/^catalog$/, 'catalogue'],
  [/^fulfill$/, 'fulfil'],
  [/(defen|offen)se$/, '$1ce'],
  [/(fib|lit)er$/, '$1re'],
  [/(travel|counsel|council)(er|or|ing)$/, '$1l$2'],
  [/or(ful|ing)?$/, 'our$1'],
  [/yze$/, 'yse'],
  [/iz(e|ed|es|ing|ation|ational)$/, 'is$1'],
];
function ukSpellingOf(form) {
  for (const [re, rep] of UK_SPELLINGS) if (re.test(form)) return form.replace(re, rep);
  return null;
}

const UK_VOWEL = '[aeiouæɑɒɔəɜɪʊʌ]';
/**
 * Fallback for words absent from the UK dictionary: derives British IPA from the
 * American transcription with the main systematic differences (non-rhotic r,
 * GOAT /əʊ/, LOT /ɒ/, yod after t/d/n, -ary/-ory reduction).
 */
function deriveUkFromUs(us) {
  return us
    .replace(/oʊ/g, 'əʊ')
    .replace(new RegExp(`ɑː(?!r)`, 'g'), 'ɒ')
    .replace(new RegExp(`([ˈˌ]?)(t|d|n)uː`, 'g'), '$1$2juː')
    .replace(/[ˌ]?eri$/, 'əri')
    .replace(new RegExp(`(ɜː|ə|ɑː|ɔː)r(?!${UK_VOWEL})`, 'gu'), '$1')
    .replace(new RegExp(`(e|ɪ|ʊ|aɪ|aʊ)r(?!${UK_VOWEL})`, 'gu'), (_, v) => (v === 'e' ? 'eə' : v === 'ɪ' ? 'ɪə' : v === 'ʊ' ? 'ʊə' : v + 'ə'));
}

function overrideFor(word, pos) {
  const key = word.replace(/\s*\(.*\)$/, '').trim();
  const o = OVERRIDES[key];
  if (!o) return null;
  if (Array.isArray(o)) return o;
  return pos.trim().startsWith('v.') ? o.v : o.n;
}

const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
const missingUs = [];
const missingUk = [];
for (const w of vocab) {
  const override = overrideFor(w.word, w.partOfSpeech);
  if (override) {
    [w.pronunciation, w.pronunciationUk] = override;
    continue;
  }
  const forms = headwordForms(w.word);
  const us = forms.map((f) => lookupUs(f, w.partOfSpeech));
  w.pronunciation = us.every(Boolean) ? us.map((x) => x.ipa).join(', ') : null;
  const ukIpa = forms.map((f, i) => {
    const stressIdx = us[i]?.stressIdx ?? -1;
    const ukSpelling = ukSpellingOf(f);
    return lookupUk(f, stressIdx) ?? (ukSpelling && lookupUk(ukSpelling, stressIdx)) ?? (us[i] ? deriveUkFromUs(us[i].ipa) : null);
  });
  w.pronunciationUk = ukIpa.every(Boolean) ? ukIpa.map((x) => x.replace(/^e(ɡz|ks)ˈ/u, 'ɪ$1ˈ').replace(/^e(ɡ|k)ˈ(z|s)/u, 'ɪ$1ˈ$2')).join(', ') : null;
  if (w.pronunciation) w.pronunciation = tidyStress(w.pronunciation);
  if (w.pronunciationUk) w.pronunciationUk = tidyStress(w.pronunciationUk);
  if (!w.pronunciation) missingUs.push(w.word);
  if (!w.pronunciationUk) missingUk.push(w.word);
}

// keep key order stable: put pronunciationUk right after pronunciation
const ordered = vocab.map((w) => {
  const out = {};
  for (const [k, v] of Object.entries(w)) {
    if (k === 'pronunciationUk') continue;
    out[k] = v;
    if (k === 'pronunciation') out.pronunciationUk = w.pronunciationUk;
  }
  return out;
});
fs.writeFileSync(VOCAB, JSON.stringify(ordered));
console.log(`US: ${vocab.length - missingUs.length}/${vocab.length}, UK: ${vocab.length - missingUk.length}/${vocab.length}`);
console.log('missing US:', missingUs.join(' | '));
console.log('missing UK:', missingUk.join(' | '));
