// Regenerate the iOS PWA launch ("splash") images from ONE source image.
//
// The splash screen shown when the installed app opens is just a set of
// per-device PNGs under public/splash/. layout.tsx serves them via
// appleWebApp.startupImage, and the exact device sizes live in
// public/splash/entries.json (the single source of truth this script reads,
// so sizes never drift from what the app references).
//
// Usage:
//   node scripts/gen-splash.mjs <source-image> [--mode contain|cover] [--bg "#1d4ed8"] [--pad 0.72]
//
//   contain (default) — scale the art to fit within `pad` of the screen and
//     centre it on a solid `bg` field. Best for a logo / wordmark / lockup.
//   cover             — scale to fill the screen and centre-crop. Best for a
//     full-bleed portrait design that already reaches the edges.
//
// Notes:
//   * Provide the largest device size or bigger, portrait — at least 1290x2796.
//   * iOS caches the splash hard: remove the app from the Home Screen and
//     re-add it to see a change.
//   * Keep important content centred, clear of the top notch/Dynamic Island
//     and the bottom home indicator (that's what `pad` protects in contain mode).

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
if (!src) {
  console.error('Usage: node scripts/gen-splash.mjs <source-image> [--mode contain|cover] [--bg "#1d4ed8"] [--pad 0.72]');
  process.exit(1);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const mode = opt('mode', 'contain');
const bg = opt('bg', '#1d4ed8');
const pad = Math.min(1, Math.max(0.1, parseFloat(opt('pad', '0.72'))));

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 };
}
const background = hexToRgb(bg);

const root = process.cwd();
const splashDir = path.join(root, 'public', 'splash');
const entries = JSON.parse(await readFile(path.join(splashDir, 'entries.json'), 'utf8'));

for (const e of entries) {
  const m = e.url.match(/splash-(\d+)x(\d+)\.png$/);
  if (!m) continue;
  const W = Number(m[1]);
  const H = Number(m[2]);
  const out = path.join(splashDir, `splash-${W}x${H}.png`);

  if (mode === 'cover') {
    await sharp(src).resize(W, H, { fit: 'cover', position: 'centre' }).png().toFile(out);
  } else {
    const inner = await sharp(src)
      .resize(Math.round(W * pad), Math.round(H * pad), { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer();
    await sharp({ create: { width: W, height: H, channels: 4, background } })
      .composite([{ input: inner, gravity: 'centre' }])
      .png()
      .toFile(out);
  }
  console.log('wrote', path.relative(root, out), `(${W}x${H})`);
}

console.log(`\nDone — ${entries.length} splash images regenerated (${mode}, bg ${bg}).`);
