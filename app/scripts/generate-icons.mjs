import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const svgPath = path.join(root, 'scripts', 'icon.svg');
const outDir = path.join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const sizes = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
];

for (const { file, size } of sizes) {
  await sharp(svgPath).resize(size, size).png().toFile(path.join(outDir, file));
  console.log('wrote', file);
}

// maskable icon: same art but with extra safe-area padding (icon content inset ~20%)
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#2f6f4f' },
})
  .composite([{ input: await sharp(svgPath).resize(320, 320).toBuffer(), left: 96, top: 96 }])
  .png()
  .toFile(path.join(outDir, 'icon-maskable-512.png'));
console.log('wrote icon-maskable-512.png');
