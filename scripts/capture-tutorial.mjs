// Capture the dealer tutorial screenshots straight into public/tutorial/.
//
// Run this from a machine that can reach the portal (it can't be done from the
// build sandbox). It logs in, visits each page, and saves a PNG with the exact
// filename the tutorial expects. Real screenshots then replace the line mockups.
//
//   PORTAL_URL=https://portal.ghsbarrie.ca \
//   PORTAL_EMAIL=you@example.com \
//   PORTAL_PASSWORD='••••••' \
//   node scripts/capture-tutorial.mjs
//
// Notes:
//  - Uses playwright-core (already a dependency). It needs a Chrome/Chromium
//    binary: set CHROME_PATH=/path/to/chrome, or it tries the installed
//    Chrome channel. (Or `npm i -D playwright && npx playwright install chromium`
//    and change the launch line to use full `playwright`.)
//  - A few shots need a real deal in the account (deal / progress / upload) and
//    the chat open — those are best-effort; if a page/selector isn't found the
//    script logs it and keeps going, leaving that step on its mockup.

import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.PORTAL_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
const EMAIL = process.env.PORTAL_EMAIL;
const PASSWORD = process.env.PORTAL_PASSWORD;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tutorial');

if (!EMAIL || !PASSWORD) {
  console.error('Set PORTAL_EMAIL and PORTAL_PASSWORD env vars.');
  process.exit(1);
}

// file -> route (relative to BASE). Interactive ones are handled specially below.
const PAGES = [
  { file: '01-login.png', route: '/login', noAuth: true },
  { file: '02-navigation.png', route: '/dealer' },
  { file: '03-dashboard.png', route: '/dealer' },
  { file: '04-applications.png', route: '/dealer/applications' },
  { file: '05-new-customer.png', route: '/dealer/applications/new' },
  { file: '06-payout.png', route: '/dealer/calculator' },
  { file: '11-mail.png', route: '/dealer/mail' },
  { file: '12-marketplace.png', route: '/dealer/marketplace' },
  { file: '13-gift-cards.png', route: '/dealer/gift-cards' },
  { file: '14-leads.png', route: '/dealer/leads' },
  { file: '15-reports.png', route: '/dealer/reports' },
  { file: '16-resources.png', route: '/dealer/resources' },
  { file: '17-account.png', route: '/account' },
];

async function shoot(page, file) {
  await page.waitForTimeout(900);
  const main = page.locator('main').first();
  const target = (await main.count()) ? main : page;
  await target.screenshot({ path: path.join(OUT, file) }).catch(async () => {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false });
  });
  console.log('  saved', file);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chrome',
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Login page shot (before signing in).
  console.log('login page');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
  await shoot(page, '01-login.png');

  // Sign in.
  console.log('signing in…');
  await page.fill('input[type="email"], input[name="email"]', EMAIL).catch(() => {});
  await page.fill('input[type="password"], input[name="password"]', PASSWORD).catch(() => {});
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.click('button[type="submit"]').catch(() => {}),
  ]);
  await page.waitForTimeout(1500);

  for (const p of PAGES) {
    if (p.file === '01-login.png') continue;
    try {
      console.log(p.route);
      await page.goto(`${BASE}${p.route}`, { waitUntil: 'networkidle' });
      await shoot(page, p.file);
    } catch (e) {
      console.warn('  skipped', p.file, '-', e.message);
    }
  }

  // Interactive: open a specific deal for the deal / progress shots.
  try {
    console.log('a deal page…');
    await page.goto(`${BASE}/dealer/applications`, { waitUntil: 'networkidle' });
    const firstDeal = page.locator('a[href^="/dealer/applications/"]:not([href$="/new"])').first();
    if (await firstDeal.count()) {
      await firstDeal.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await shoot(page, '07-deal.png');
      await shoot(page, '08-progress.png'); // same page; crop later if desired
      await shoot(page, '09-upload.png');
    } else {
      console.warn('  no deals found — 07/08/09 left on mockups');
    }
  } catch (e) {
    console.warn('  deal shots skipped -', e.message);
  }

  // Interactive: open the corner chat.
  try {
    console.log('chat widget…');
    await page.goto(`${BASE}/dealer`, { waitUntil: 'networkidle' });
    const chatBtn = page.locator('button[aria-label*="chat" i]').first();
    if (await chatBtn.count()) {
      await chatBtn.click();
      await page.waitForTimeout(700);
      await shoot(page, '10-chat.png');
    } else {
      console.warn('  chat launcher not found — 10 left on mockup');
    }
  } catch (e) {
    console.warn('  chat shot skipped -', e.message);
  }

  await browser.close();
  console.log('\nDone. Review public/tutorial/, then commit the PNGs.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
