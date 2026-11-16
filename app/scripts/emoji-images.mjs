// Gives abstract words (feelings, actions, qualities) an emoji illustration from
// Google's Noto Emoji set (Apache-2.0, see public/images/words/NOTICE-noto-emoji.txt).
//
// scripts/emoji-map.json maps word id -> emoji code point(s), e.g. "angry-b1": "1f620".
// Every entry was chosen by hand for the word's meaning. A word that already has a
// photo keeps it; the emoji is only used where there is no image.
//
// Usage: node scripts/emoji-images.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getIconData, iconToSVG, iconToHTML, replaceIDs } from '@iconify/utils';

const APP = new URL('..', import.meta.url).pathname;
const VOCAB = path.join(APP, 'public/data/vocabulary.json');
const MAP = JSON.parse(fs.readFileSync(path.join(APP, 'scripts/emoji-map.json'), 'utf8'));
const req = (p) => JSON.parse(fs.readFileSync(path.join(APP, 'node_modules/@iconify-json/noto', p), 'utf8'));
const icons = req('icons.json');
const chars = req('chars.json');

// soft pastel backgrounds, picked per word so neighbouring cards differ
const BACKGROUNDS = ['#fde8d7', '#e3f0e6', '#e4ecfa', '#f6e3f1', '#fff4cc', '#e6f4f4', '#efe7fb', '#fbe4e4'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function emojiSvg(hex) {
  const name = chars[hex];
  const data = name && getIconData(icons, name);
  if (!data) throw new Error(`no Noto emoji for ${hex}`);
  const rendered = iconToSVG(data, { height: 200 });
  return iconToHTML(replaceIDs(rendered.body), rendered.attributes);
}

const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
const byId = Object.fromEntries(vocab.map((w) => [w.id, w]));
let added = 0;
let kept = 0;
for (const [id, hex] of Object.entries(MAP)) {
  const w = byId[id];
  if (!w) throw new Error(`unknown word id ${id}`);
  const file = `images/words/${id}-emoji.webp`;
  if (w.imageUrl && w.imageUrl !== file) {
    kept++;
    continue;
  }
  const emoji = await sharp(Buffer.from(emojiSvg(hex))).resize(200, 200, { fit: 'contain', background: '#0000' }).png().toBuffer();
  await sharp({ create: { width: 400, height: 300, channels: 4, background: BACKGROUNDS[hash(id) % BACKGROUNDS.length] } })
    .composite([{ input: emoji, gravity: 'center' }])
    .webp({ quality: 80 })
    .toFile(path.join(APP, 'public', file));
  w.imageUrl = file;
  w.imageCredit = null;
  added++;
}
fs.writeFileSync(VOCAB, JSON.stringify(vocab));
console.log(`emoji images: ${added} set, ${kept} words already had a photo`);
