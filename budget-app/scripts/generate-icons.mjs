// İkonları SVG-dən PNG-yə çevirir. İstifadə: npm i -D playwright && npm run icons
// (PNG-lər artıq public/icons-da var; yalnız dizaynı dəyişəndə yenidən işlədin.)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const svg = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1c46ac"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <rect x="96" y="150" width="320" height="220" rx="44"/>
    <path d="M96 205h320"/>
    <circle cx="340" cy="290" r="20" fill="#fff" stroke="none"/>
  </g>
</svg>`;

const targets = [
  ["icon-192.png", 192, 0.1],
  ["icon-512.png", 512, 0.1],
  ["icon-maskable-512.png", 512, 0.3],
  ["apple-touch-icon.png", 180, 0.12],
];

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
for (const [name, size, pad] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg(size, pad)}</body>`);
  await page.screenshot({ path: `public/icons/${name}` });
  await page.close();
}
await browser.close();
console.log("İkonlar yaradıldı");
