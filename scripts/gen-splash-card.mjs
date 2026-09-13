// Build the iOS PWA launch ("splash") images: the official GWA horizontal logo
// on a white rounded card, centred on the brand-blue field. One image per device
// size listed in public/splash/entries.json (the list layout.tsx serves).
//
// Re-run after changing the logo or the look:
//   node scripts/gen-splash-card.mjs
//
// Options: --logo <path>  --bg "#1d4ed8"  --card "#ffffff"
//
// iOS caches the splash hard — remove the app from the Home Screen and re-add it
// to see a change.

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const logoPath = opt('logo', 'public/brand/gwa-logo-horizontal.png');
const bgHex = opt('bg', '#1d4ed8');
const cardHex = opt('card', '#ffffff');

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
};
const bg = hexToRgb(bgHex);

const root = process.cwd();
const splashDir = path.join(root, 'public', 'splash');
const entries = JSON.parse(await readFile(path.join(splashDir, 'entries.json'), 'utf8'));

for (const e of entries) {
  const m = e.url.match(/splash-(\d+)x(\d+)\.png$/);
  if (!m) continue;
  const W = Number(m[1]);
  const H = Number(m[2]);

  // Card + logo sizing scales off the device WIDTH so it looks consistent on
  // every screen. Card is centred; logo sits inside with even padding.
  const cardW = Math.round(W * 0.82);
  const rad = Math.round(W * 0.055);
  const logoW = Math.round(cardW * 0.82);

  const logo = await sharp(logoPath).resize(logoW, null, { fit: 'inside' }).png().toBuffer();
  const lm = await sharp(logo).metadata();
  const padY = Math.round(cardW * 0.15);
  const cardH = lm.height + padY * 2;

  const card = Buffer.from(
    `<svg width="${cardW}" height="${cardH}"><rect x="0" y="0" width="${cardW}" height="${cardH}" rx="${rad}" ry="${rad}" fill="${cardHex}"/></svg>`,
  );
  const cardImg = await sharp(card).composite([{ input: logo, gravity: 'centre' }]).png().toBuffer();

  const out = path.join(splashDir, `splash-${W}x${H}.png`);
  await sharp({ create: { width: W, height: H, channels: 4, background: bg } })
    .composite([{ input: cardImg, gravity: 'centre' }])
    .png()
    .toFile(out);
  console.log('wrote', path.relative(root, out), `(${W}x${H})`);
}

console.log(`\nDone — ${entries.length} splash images rebuilt (logo card on ${bgHex}).`);
