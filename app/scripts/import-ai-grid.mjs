// Imports a grid image of AI-generated word illustrations (made in ChatGPT / Gemini
// from a prompt listing the words in reading order) into the app.
//
// Usage: node scripts/import-ai-grid.mjs <grid image> <rows> <cols> <id1,id2,...> [--skip id,id] [--dry-run]
//   ids are word ids in the same left-to-right, top-to-bottom order as the prompt;
//   --skip leaves out cells that were judged wrong on review.
//
// Generators often draw cells of slightly unequal size with no gutters, so each
// boundary is located near its expected position by the strongest background-colour
// jump along the top strip of the row (and the outer edges for row boundaries).
// Each record is logged in scripts/ai-images-log.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const APP = new URL('..', import.meta.url).pathname;
const VOCAB = path.join(APP, 'public/data/vocabulary.json');
const LOG = path.join(APP, 'scripts/ai-images-log.json');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [file, rowsArg, colsArg, idsArg] = args;
const R = Number(rowsArg);
const C = Number(colsArg);
const ids = (idsArg ?? '').split(',').filter(Boolean);
const skip = new Set((flag('--skip') ?? '').split(',').filter(Boolean));
const DRY = args.includes('--dry-run');
if (!file || !R || !C || ids.length !== R * C) {
  console.error(`usage: node scripts/import-ai-grid.mjs <image> <rows> <cols> <${'id,'.repeat(2)}...> (need rows*cols ids, got ${ids.length})`);
  process.exit(1);
}

const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const px = (x, y) => {
  const i = (y * W + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
const jump = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

function strongestNear(score, len, expected, window) {
  let best = expected;
  let bestScore = -1;
  for (let p = Math.max(4, expected - window); p < Math.min(len - 4, expected + window); p++) {
    const s = score(p);
    if (s > bestScore) [best, bestScore] = [p, s];
  }
  return best;
}

const edgeXs = [4, 8, W - 5, W - 9, Math.round(W / C) - 6, Math.round(W / C) + 6];
const rowEdges = [0];
for (let r = 1; r < R; r++) {
  const score = (y) => edgeXs.reduce((s, x) => s + jump(px(x, y - 3), px(x, y + 3)), 0);
  rowEdges.push(strongestNear(score, H, Math.round((H * r) / R), Math.round(H / R / 3)));
}
rowEdges.push(H);

const cells = [];
for (let r = 0; r < R; r++) {
  const y0 = rowEdges[r];
  // the top strip of a row is almost always plain background; lower down, drawings can cross cells
  const ys = [3, 5, 7, 9, 11, 13].map((d) => y0 + d);
  const colEdges = [0];
  for (let c = 1; c < C; c++) {
    const score = (x) => ys.reduce((s, y) => s + jump(px(x - 3, y), px(x + 3, y)), 0);
    colEdges.push(strongestNear(score, W, Math.round((W * c) / C), Math.round(W / C / 3)));
  }
  colEdges.push(W);
  for (let c = 0; c < C; c++) {
    cells.push({ left: colEdges[c], top: y0, width: colEdges[c + 1] - colEdges[c], height: rowEdges[r + 1] - y0 });
  }
}

const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
const byId = Object.fromEntries(vocab.map((w) => [w.id, w]));
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : {};
const source = path.basename(file);
let added = 0;
for (const [i, cell] of cells.entries()) {
  const id = ids[i];
  const w = byId[id];
  if (!w) throw new Error(`unknown word id ${id}`);
  console.log(`${String(i + 1).padStart(2)} ${id.padEnd(28)} ${cell.left},${cell.top} ${cell.width}x${cell.height}${skip.has(id) ? '  (skipped)' : ''}`);
  if (skip.has(id) || DRY) continue;
  const inset = 3; // stay clear of anti-aliased borders and neighbouring cells
  const out = `images/words/${id}.webp`;
  await sharp(file)
    .extract({ left: cell.left + inset, top: cell.top + inset, width: cell.width - 2 * inset, height: cell.height - 2 * inset })
    .resize(400, 300, { fit: 'cover', kernel: 'lanczos3' })
    .webp({ quality: 80 })
    .toFile(path.join(APP, 'public', out));
  w.imageUrl = out;
  w.imageCredit = null;
  log[id] = { source, cell: i + 1 };
  added++;
}
if (!DRY) {
  fs.writeFileSync(VOCAB, JSON.stringify(vocab));
  fs.writeFileSync(LOG, JSON.stringify(Object.fromEntries(Object.entries(log).sort(([a], [b]) => a.localeCompare(b))), null, 1) + '\n');
}
console.log(DRY ? 'dry run' : `${added} images added`);
