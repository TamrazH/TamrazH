// Imports a grid image of AI-generated word illustrations (made in ChatGPT / Gemini
// from a prompt listing the words in reading order) into the app.
//
// Usage: node scripts/import-ai-grid.mjs <grid image> <rows> <cols> (<id1,id2,...> | --batch N) [--skip id,id] [--dry-run]
//   ids are word ids in the same left-to-right, top-to-bottom order as the prompt;
//   --skip leaves out cells that were judged wrong on review.
//
// Generators often draw cells of slightly unequal size with no gutters, so each
// boundary is located near its expected position by the strongest background-colour
// jump along the top strip of the row (and the outer edges for row boundaries).
// White gutters, when the generator draws them, are detected and excluded exactly.
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
const [file, rowsArg, colsArg] = args;
const idsArg = args[3]?.startsWith('--') ? undefined : args[3];
const R = Number(rowsArg);
const C = Number(colsArg);
const batchNo = flag('--batch');
const ids = batchNo
  ? JSON.parse(fs.readFileSync(path.join(APP, 'scripts/ai-batches.json'), 'utf8'))[batchNo]
  : (idsArg ?? '').split(',').filter(Boolean);
if (batchNo && !ids) throw new Error(`no batch ${batchNo} in scripts/ai-batches.json`);
const skip = new Set((flag('--skip') ?? '').split(',').filter(Boolean));
const DRY = args.includes('--dry-run');
// a short last batch leaves trailing cells empty
if (!file || !R || !C || ids.length > R * C || ids.length <= (R - 1) * C) {
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

const isWhite = (x, y) => {
  const [r, g, b] = px(x, y);
  return r > 235 && g > 235 && b > 235;
};

/**
 * Finds the boundary between cell k-1 and k along one axis. A white gutter (a run of
 * lines that are almost entirely white across the band) gives exact edges; otherwise the
 * strongest background colour jump near the expected position is used.
 * Returns [end of previous cell, start of next cell].
 */
function boundary(len, expected, window, whiteFraction, jumpScore) {
  const lo = Math.max(4, expected - window);
  const hi = Math.min(len - 4, expected + window);
  let runStart = -1;
  let best = null;
  for (let p = lo; p <= hi; p++) {
    const white = p < hi && whiteFraction(p) > 0.92;
    if (white && runStart < 0) runStart = p;
    if (!white && runStart >= 0) {
      const mid = (runStart + p) / 2;
      if (!best || Math.abs(mid - expected) < Math.abs((best[0] + best[1]) / 2 - expected)) best = [runStart, p];
      runStart = -1;
    }
  }
  if (best) return best;
  const p = strongestNear(jumpScore, len, expected, window);
  return [p, p];
}

const edgeXs = [4, 8, W - 5, W - 9, Math.round(W / C) - 6, Math.round(W / C) + 6];
const sample = (from, to, n) => Array.from({ length: n }, (_, i) => Math.round(from + ((to - from - 1) * i) / (n - 1)));
const rowBounds = [[0, 0]];
for (let r = 1; r < R; r++) {
  const xs = sample(0, W, 200);
  rowBounds.push(
    boundary(
      H,
      Math.round((H * r) / R),
      Math.round(H / R / 3),
      (y) => xs.filter((x) => isWhite(x, y)).length / xs.length,
      (y) => edgeXs.reduce((s, x) => s + jump(px(x, y - 3), px(x, y + 3)), 0),
    ),
  );
}
rowBounds.push([H, H]);

const cells = [];
for (let r = 0; r < R; r++) {
  const y0 = rowBounds[r][1];
  const y1 = rowBounds[r + 1][0];
  // the top strip of a row is almost always plain background; lower down, drawings can cross cells
  const ys = [3, 5, 7, 9, 11, 13].map((d) => y0 + d);
  const bandYs = sample(y0, y1, 120);
  const colBounds = [[0, 0]];
  for (let c = 1; c < C; c++) {
    colBounds.push(
      boundary(
        W,
        Math.round((W * c) / C),
        Math.round(W / C / 3),
        (x) => bandYs.filter((y) => isWhite(x, y)).length / bandYs.length,
        (x) => ys.reduce((s, y) => s + jump(px(x - 3, y), px(x + 3, y)), 0),
      ),
    );
  }
  colBounds.push([W, W]);
  for (let c = 0; c < C; c++) {
    const left = colBounds[c][1];
    cells.push({ left, top: y0, width: colBounds[c + 1][0] - left, height: y1 - y0 });
  }
}

const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
const byId = Object.fromEntries(vocab.map((w) => [w.id, w]));
const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : {};
const source = path.basename(file);
let added = 0;
for (const [i, cell] of cells.slice(0, ids.length).entries()) {
  const id = ids[i];
  const w = byId[id];
  if (!w) throw new Error(`unknown word id ${id}`);
  console.log(`${String(i + 1).padStart(2)} ${id.padEnd(28)} ${cell.left},${cell.top} ${cell.width}x${cell.height}${skip.has(id) ? '  (skipped)' : ''}`);
  if (skip.has(id) || DRY) continue;
  const inset = 3; // stay clear of anti-aliased borders and neighbouring cells
  const out = `images/words/${id}.webp`;
  // two steps: sharp applies trim before extract within a single pipeline
  const cellImage = await sharp(file)
    .extract({ left: cell.left + inset, top: cell.top + inset, width: cell.width - 2 * inset, height: cell.height - 2 * inset })
    .toBuffer();
  await sharp(cellImage)
    .trim({ background: '#ffffff', threshold: 25 }) // white outer frame some generators add
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
