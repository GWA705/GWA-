import 'server-only';
import { prisma } from '../db';
import { readJournal, type ReportDeal } from './journalRead';
import { getSetting } from '../settings';
import { sendEmail } from '../email';
import { listStoreContacts, resolveStoreRecipients, getNationalRecipients, extractEmails, DISTRICT_SEED, type StoreContact } from '../hdStoreContacts';

/**
 * Weekly Home Depot reports (per-store + national), generated in-portal off the
 * sales journal — the replacement for the Google Apps Script. Money basis is the
 * same as every other report: OK deals, by Date Paid, gross. Store-lead (701)
 * sales carry Home Depot associate recognition. Bulletproof table HTML (Outlook/
 * Gmail safe), logo + name up top, From/Reply-To reporter@, recipients BCC'd.
 */

const NAVY = '#0a1628';
const BLUE = '#1a5fa8';
const ORANGE = '#e07b00';
const SENDER_FROM = 'Georgian Water and Air <reporter@ghsbarrie.ca>';
const SENDER_REPLYTO = 'reporter@ghsbarrie.ca';

export function weeklySenderIdentity() {
  return { from: SENDER_FROM, replyTo: SENDER_REPLYTO };
}
export function appUrl(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}
export async function weeklyReportsEnabled(): Promise<boolean> {
  return (await getSetting('hdReport.weeklyEnabled')) === '1';
}

const digits = (s: string) => (s || '').replace(/\D/g, '');
const validHdRef = (ref: string) => /^(800|7\d{2})/.test(digits(ref));
const is701 = (ref: string) => /^7\d{2}/.test(digits(ref));
const money = (n: number) => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (n: number) => (n > 0 ? '$' + Math.round(n).toLocaleString('en-CA') : '—');
const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

// ---------------------------------------------------------------------------
// Week window
// ---------------------------------------------------------------------------
export interface Week { start: Date; end: Date; label: string }
export function lastFullWeek(ref: Date = new Date()): Week {
  const d = new Date(ref);
  const dow = d.getDay(); // 0 Sun..6 Sat
  const toMon = dow === 0 ? 6 : dow - 1;
  const thisMon = new Date(d); thisMon.setDate(d.getDate() - toMon); thisMon.setHours(0, 0, 0, 0);
  const start = new Date(thisMon); start.setDate(thisMon.getDate() - 7);
  const end = new Date(thisMon); end.setDate(thisMon.getDate() - 1); end.setHours(23, 59, 59, 999);
  return { start, end, label: `${fmtDate(start)} – ${fmtDate(end)}` };
}

// ---------------------------------------------------------------------------
// Journal helpers
// ---------------------------------------------------------------------------
async function paidOkDeals(start: Date, end: Date): Promise<ReportDeal[]> {
  const years = Array.from(new Set([start.getFullYear(), end.getFullYear()]));
  const reads = await Promise.all(years.map((y) => readJournal(y).catch(() => null)));
  const out: ReportDeal[] = [];
  for (const r of reads) {
    if (!r) continue;
    for (const d of r.deals) {
      if (d.result !== 'OK' || !d.datePaid) continue;
      if (d.datePaid < start || d.datePaid > end) continue;
      if (!validHdRef(d.hdRef)) continue;
      out.push(d);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-store report
// ---------------------------------------------------------------------------
export interface StoreSale {
  hdRef: string; customer: string; datePaid: string; products: string; value: number;
  is701: boolean; associateName: string | null; associateSource: string | null;
}
export interface StoreReport {
  storeNumber: string; storeName: string; weekLabel: string;
  sales: StoreSale[]; total: number; to: string[]; cc: string[];
  needsAssociate: number; // 701 sales with no associate credited yet
  active: boolean; // the store contact is active (included in the send)
}

export async function assembleStoreReports(week: Week): Promise<StoreReport[]> {
  const deals = await paidOkDeals(week.start, week.end);
  const contacts = await listStoreContacts();
  const byStore = new Map<string, StoreContact>();
  for (const c of contacts) byStore.set(c.storeNumber, c);

  // Associate credits for the 701 refs in this batch.
  const refs701 = Array.from(new Set(deals.filter((d) => is701(d.hdRef)).map((d) => digits(d.hdRef))));
  const credits = refs701.length
    ? await prisma.hdStoreLeadCredit.findMany({ where: { hdRef: { in: refs701 } } })
    : [];
  const creditByRef = new Map(credits.map((c) => [c.hdRef, c]));

  const groups = new Map<string, StoreReport>();
  for (const d of deals) {
    const storeNum = d.storeNumber || (d.hdStore.match(/\b(7\d{3})\b/)?.[1] ?? '');
    if (!storeNum) continue;
    const c = byStore.get(storeNum);
    let g = groups.get(storeNum);
    if (!g) {
      const rec = c ? resolveStoreRecipients(c) : { to: [], cc: [] };
      g = {
        storeNumber: storeNum,
        storeName: c?.storeName || d.hdStore.replace(/\b7\d{3}\b/, '').replace(/[-–#]/g, ' ').replace(/\s+/g, ' ').trim() || storeNum,
        weekLabel: week.label, sales: [], total: 0, to: rec.to, cc: rec.cc, needsAssociate: 0, active: c?.active ?? true,
      };
      groups.set(storeNum, g);
    }
    const ref = digits(d.hdRef);
    const credit = creditByRef.get(ref);
    const store701 = is701(d.hdRef);
    if (store701 && !credit?.associateName && credit?.source !== 'ONLINE') g.needsAssociate += 1;
    g.sales.push({
      hdRef: ref,
      customer: [d.lastName, d.firstName].map((s) => (s || '').trim()).filter(Boolean).join(', ') || '—',
      datePaid: fmtDate(d.datePaid), products: (d.product || '').trim(), value: d.gross,
      is701: store701, associateName: credit?.associateName ?? null, associateSource: credit?.source ?? null,
    });
    g.total += d.gross;
  }
  return Array.from(groups.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export function renderStoreEmailHtml(r: StoreReport): string {
  const url = appUrl();
  const cards = r.sales.map((s) => {
    const accent = s.is701 ? ORANGE : BLUE;
    const ribbon = s.is701
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px"><tr><td style="background-color:#fff3e2;border:1px solid #f3d6ad;padding:7px 11px;">
          <span style="font-family:Arial,sans-serif;font-size:11px;color:#8a5a12;font-weight:bold;letter-spacing:.4px;">&#9733; HOME DEPOT ${s.associateSource === 'ONLINE' ? 'ONLINE LEAD' : 'ASSOCIATE CREDIT'}</span>
          <span style="font-family:Arial,sans-serif;font-size:13px;color:#0a1628;font-weight:bold;">&nbsp;&mdash;&nbsp;${esc(s.associateName || (s.associateSource === 'ONLINE' ? 'homedepot.ca' : 'associate to be credited'))}</span>
        </td></tr></table>` : '';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px"><tr>
      <td style="background-color:#ffffff;border-left:4px solid ${accent};padding:14px 16px;">
        ${ribbon}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td align="left" style="font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#0a1628;">${esc(s.customer)}</td>
          <td align="right" style="font-family:Arial,sans-serif;font-size:21px;font-weight:bold;color:${accent};">${money(s.value)}</td>
        </tr><tr><td colspan="2" style="font-family:Arial,sans-serif;font-size:12px;color:#6b7a8c;padding-top:4px;">
          Lead ID# <strong style="color:#0a1628;">${esc(s.hdRef)}</strong> &nbsp;&middot;&nbsp; Paid: <strong style="color:#0a1628;">${esc(s.datePaid)}</strong>
        </td></tr></table>
        ${s.products ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px"><tr><td style="background-color:#f4f6f9;padding:8px 12px;">
          <span style="font-family:Arial,sans-serif;font-size:10px;color:#9aa7b5;text-transform:uppercase;letter-spacing:1px;">Products</span><br>
          <span style="font-family:Arial,sans-serif;font-size:13px;color:#0a1628;font-weight:bold;">${esc(s.products)}</span></td></tr></table>` : ''}
      </td></tr></table>`;
  }).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="x-apple-disable-message-reformatting"/>
<!--[if mso]><style type="text/css">table,td,div,p{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--></head>
<body style="margin:0;padding:0;background-color:#eef2f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;">
  <tr><td align="center" style="background-color:${NAVY};padding:20px;">
    <img src="${url}/gwa-logo-dark.png" alt="Georgian Water &amp; Air" width="360" style="display:block;width:360px;max-width:88%;height:auto;border:0;margin:0 auto 8px;">
    <div style="font-family:Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">Georgian Water &amp; Air</div>
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#7a9bbf;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Home Depot&#39;s Water &amp; Air Treatment Team</div>
  </td></tr>
  <tr><td style="background-color:${BLUE};padding:14px 24px;">
    <span style="font-family:Arial,sans-serif;font-size:11px;color:#a8c8f0;text-transform:uppercase;letter-spacing:1px;">Weekly Sales Update</span><br>
    <span style="font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">${esc(r.storeName.toUpperCase())}</span>
    <span style="font-family:Arial,sans-serif;font-size:13px;color:#c8e0f8;">#${esc(r.storeNumber)}</span><br>
    <span style="font-family:Arial,sans-serif;font-size:12px;color:#c8e0f8;">${esc(r.weekLabel)}</span>
  </td></tr>
  <tr><td style="background-color:#ffffff;padding:22px 24px 6px;">
    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;color:#2c3e50;line-height:22px;">Dear <strong>${esc(r.storeName)} Team</strong>,<br>
    Here is your GWA sales update for <strong>${esc(r.weekLabel)}</strong>. Thank you for your continued partnership &mdash; these results reflect the great work your team does every day.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;"><tr><td height="2" style="background-color:${BLUE};font-size:2px;line-height:2px;">&nbsp;</td></tr></table>
  </td></tr>
  <tr><td style="background-color:#ffffff;padding:0 24px;">${cards}</td></tr>
  <tr><td style="background-color:${ORANGE};padding:16px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="left"><span style="font-family:Arial,sans-serif;font-size:11px;color:#ffe8cc;text-transform:uppercase;letter-spacing:1px;">Total Sales This Week</span><br>
    <span style="font-family:Arial,sans-serif;font-size:12px;color:#ffd9ad;">${r.sales.length} confirmed sale${r.sales.length !== 1 ? 's' : ''} &middot; Store #${esc(r.storeNumber)}</span></td>
    <td align="right"><span style="font-family:Arial,sans-serif;font-size:27px;font-weight:bold;color:#ffffff;">${money(r.total)}</span></td>
  </tr></table></td></tr>
  <tr><td align="center" style="background-color:${NAVY};padding:16px 24px;">
    <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;color:#7a9bbf;">11 King St #10, Barrie ON &middot; 1-866-840-2789 &middot; info@georgianwaterandair.ca</p>
    <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;color:#3a5a7a;letter-spacing:1px;text-transform:uppercase;">Authorized Home Depot Home Services Partner &middot; Canada</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// ---------------------------------------------------------------------------
// National report (district roll-up: TY vs LY week + YTD)
// ---------------------------------------------------------------------------
export interface DistrictRow { district: string; ty: number; tyCount: number; ly: number; lyCount: number; ytdTy: number; ytdLy: number }
export interface NationalReport { weekLabel: string; lyLabel: string; rows: DistrictRow[]; totals: DistrictRow }

async function districtMap(): Promise<Map<string, string>> {
  const contacts = await listStoreContacts();
  const m = new Map<string, string>();
  for (const [num, d] of Object.entries(DISTRICT_SEED)) m.set(num, d);
  for (const c of contacts) if (c.district) m.set(c.storeNumber, c.district); // portal overrides seed
  return m;
}

export async function assembleNational(week: Week): Promise<NationalReport> {
  const dmap = await districtMap();
  const distOf = (d: ReportDeal) => dmap.get(d.storeNumber || (d.hdStore.match(/\b(7\d{3})\b/)?.[1] ?? '')) || 'Other';

  const lyStart = new Date(week.start); lyStart.setFullYear(lyStart.getFullYear() - 1);
  const lyEnd = new Date(week.end); lyEnd.setFullYear(lyEnd.getFullYear() - 1);
  const yStart = new Date(week.end.getFullYear(), 0, 1);
  const ytdLyStart = new Date(week.end.getFullYear() - 1, 0, 1);
  const ytdLyEnd = new Date(lyEnd);

  const [tyWeek, lyWeek, ytdTy, ytdLy] = await Promise.all([
    paidOkDeals(week.start, week.end),
    paidOkDeals(lyStart, lyEnd),
    paidOkDeals(yStart, week.end),
    paidOkDeals(ytdLyStart, ytdLyEnd),
  ]);

  const rows = new Map<string, DistrictRow>();
  const get = (name: string) => {
    let r = rows.get(name);
    if (!r) { r = { district: name, ty: 0, tyCount: 0, ly: 0, lyCount: 0, ytdTy: 0, ytdLy: 0 }; rows.set(name, r); }
    return r;
  };
  for (const d of tyWeek) { const r = get(distOf(d)); r.ty += d.gross; r.tyCount += 1; }
  for (const d of lyWeek) { const r = get(distOf(d)); r.ly += d.gross; r.lyCount += 1; }
  for (const d of ytdTy) get(distOf(d)).ytdTy += d.gross;
  for (const d of ytdLy) get(distOf(d)).ytdLy += d.gross;

  const list = Array.from(rows.values()).sort((a, b) => a.district.localeCompare(b.district));
  const totals: DistrictRow = { district: 'GRAND TOTAL', ty: 0, tyCount: 0, ly: 0, lyCount: 0, ytdTy: 0, ytdLy: 0 };
  for (const r of list) { totals.ty += r.ty; totals.tyCount += r.tyCount; totals.ly += r.ly; totals.lyCount += r.lyCount; totals.ytdTy += r.ytdTy; totals.ytdLy += r.ytdLy; }
  return { weekLabel: week.label, lyLabel: `${fmtDate(lyStart)} – ${fmtDate(lyEnd)}`, rows: list, totals };
}

function chg(ty: number, ly: number): string {
  if (ly === 0 && ty === 0) return '<span style="color:#aaa;">N/A</span>';
  if (ly === 0) return '<span style="color:#1a7a4a;font-weight:bold;">New</span>';
  const p = Math.round(((ty - ly) / ly) * 100);
  return p >= 0 ? `<span style="color:#1a7a4a;font-weight:bold;">+${p}%</span>` : `<span style="color:#c0392b;font-weight:bold;">${p}%</span>`;
}

export function renderNationalEmailHtml(n: NationalReport): string {
  const url = appUrl();
  const ytdPct = n.totals.ytdLy > 0 ? Math.round(((n.totals.ytdTy - n.totals.ytdLy) / n.totals.ytdLy) * 100) : 0;
  const body = n.rows.map((r) => `<tr>
    <td style="font-family:Arial,sans-serif;font-size:12px;color:#0a1628;padding:7px 12px;border-bottom:1px solid #eaeef4;font-weight:bold;">${esc(r.district)}</td>
    <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#555;padding:7px 8px;border-bottom:1px solid #eaeef4;">${money0(r.ly)}</td>
    <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#0a1628;padding:7px 8px;border-bottom:1px solid #eaeef4;font-weight:bold;">${money0(r.ty)}</td>
    <td align="right" style="font-family:Arial,sans-serif;font-size:11px;padding:7px 8px;border-bottom:1px solid #eaeef4;border-right:2px solid #c8d6e8;">${chg(r.ty, r.ly)}</td>
    <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#555;padding:7px 8px;border-bottom:1px solid #eaeef4;background:#f4f7fb;">${money0(r.ytdLy)}</td>
    <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#0a1628;padding:7px 8px;border-bottom:1px solid #eaeef4;background:#f4f7fb;font-weight:bold;">${money0(r.ytdTy)}</td>
    <td align="right" style="font-family:Arial,sans-serif;font-size:11px;padding:7px 8px;border-bottom:1px solid #eaeef4;background:#f4f7fb;">${chg(r.ytdTy, r.ytdLy)}</td>
  </tr>`).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="x-apple-disable-message-reformatting"/>
<!--[if mso]><style type="text/css">table,td,div,p{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]--></head>
<body style="margin:0;padding:0;background-color:#eef2f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef2f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="760" cellpadding="0" cellspacing="0" border="0" style="width:760px;max-width:760px;background-color:#ffffff;">
  <tr><td align="center" style="background-color:${NAVY};padding:20px;">
    <img src="${url}/gwa-logo-dark.png" alt="Georgian Water &amp; Air" width="380" style="display:block;width:380px;max-width:80%;height:auto;border:0;margin:0 auto 8px;">
    <div style="font-family:Arial,sans-serif;font-size:17px;font-weight:bold;color:#ffffff;">Georgian Water &amp; Air</div>
    <div style="font-family:Arial,sans-serif;font-size:12px;color:#7a9bbf;">National Weekly Sales Summary &middot; Home Depot Home Services Partner</div>
  </td></tr>
  <tr><td align="center" style="background-color:${BLUE};padding:12px 28px;">
    <span style="font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;">Week: ${esc(n.weekLabel)}</span>
  </td></tr>
  <tr><td style="padding:20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border:1px solid #dde3eb;"><tr>
      <td width="50%" align="center" style="background-color:${BLUE};padding:14px;"><span style="font-family:Arial,sans-serif;font-size:10px;color:#cfe1f5;text-transform:uppercase;letter-spacing:1px;">Last Year (week)</span><br><span style="font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#fff;">${money0(n.totals.ly)}</span><br><span style="font-family:Arial,sans-serif;font-size:11px;color:#cfe1f5;">${n.totals.lyCount} sales &middot; ${esc(n.lyLabel)}</span></td>
      <td width="50%" align="center" style="background-color:${ORANGE};padding:14px;"><span style="font-family:Arial,sans-serif;font-size:10px;color:#ffe8cc;text-transform:uppercase;letter-spacing:1px;">This Year (week)</span><br><span style="font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#fff;">${money0(n.totals.ty)}</span><br><span style="font-family:Arial,sans-serif;font-size:11px;color:#ffe8cc;">${n.totals.tyCount} sales &middot; vs LY ${chg(n.totals.ty, n.totals.ly)}</span></td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dde3eb;">
      <tr style="background-color:${NAVY};">
        <th align="left" style="font-family:Arial,sans-serif;font-size:10px;color:#7a9bbf;padding:8px 12px;">DISTRICT</th>
        <th align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#7a9bbf;padding:8px;">LY $</th>
        <th align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#fff;padding:8px;">TY $</th>
        <th align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#fff;padding:8px;border-right:2px solid #2d4a6b;">VS LY</th>
        <th align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#a8bcce;padding:8px;background:#0d1f36;">LY YTD</th>
        <th align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#fff;padding:8px;background:#0d1f36;">TY YTD</th>
        <th align="right" style="font-family:Arial,sans-serif;font-size:10px;color:#fff;padding:8px;background:#0d1f36;">YTD %</th>
      </tr>
      ${body}
      <tr style="background-color:#1a2e44;">
        <td style="font-family:Arial,sans-serif;font-size:12px;color:#fff;padding:9px 12px;font-weight:bold;">GRAND TOTAL</td>
        <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#a8bcce;padding:9px 8px;font-weight:bold;">${money0(n.totals.ly)}</td>
        <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#fff;padding:9px 8px;font-weight:bold;">${money0(n.totals.ty)}</td>
        <td align="right" style="padding:9px 8px;border-right:2px solid #2d4a6b;">${chg(n.totals.ty, n.totals.ly)}</td>
        <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#a8bcce;padding:9px 8px;font-weight:bold;background:#162438;">${money0(n.totals.ytdLy)}</td>
        <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#fff;padding:9px 8px;font-weight:bold;background:#162438;">${money0(n.totals.ytdTy)}</td>
        <td align="right" style="padding:9px 8px;background:#162438;">${ytdPct >= 0 ? `<span style="color:#7ee0a6;font-weight:bold;">+${ytdPct}%</span>` : `<span style="color:#ff9a9a;font-weight:bold;">${ytdPct}%</span>`}</td>
      </tr>
    </table>
  </td></tr>
  <tr><td align="center" style="background-color:${NAVY};padding:14px 20px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#7a9bbf;">Georgian Water &amp; Air &middot; Home Depot Home Services Partner &middot; Canada</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// ---------------------------------------------------------------------------
// Associate attribution (701 store leads)
// ---------------------------------------------------------------------------
export interface LeadSale {
  hdRef: string; customer: string; storeNumber: string; storeName: string;
  value: number; datePaid: string; associateName: string | null; associateSource: string | null;
}

/** Every 701 store-lead sale in the week, for the attribution screen. */
export async function listStoreLeadSales(week: Week): Promise<LeadSale[]> {
  const reports = await assembleStoreReports(week);
  const out: LeadSale[] = [];
  for (const r of reports) {
    for (const s of r.sales) {
      if (!s.is701) continue;
      out.push({ hdRef: s.hdRef, customer: s.customer, storeNumber: r.storeNumber, storeName: r.storeName, value: s.value, datePaid: s.datePaid, associateName: s.associateName, associateSource: s.associateSource });
    }
  }
  return out.sort((a, b) => a.storeName.localeCompare(b.storeName) || b.value - a.value);
}

/** A 701 sale still needs attention unless it's marked ONLINE or has an associate. */
export function leadNeedsAssociate(s: { associateName: string | null; associateSource: string | null }): boolean {
  return s.associateSource !== 'ONLINE' && !(s.associateName && s.associateName.trim());
}

// ---------------------------------------------------------------------------
// The real send (BCC every recipient; From/Reply-To reporter@; log-guarded)
// ---------------------------------------------------------------------------
async function alwaysBcc(): Promise<string[]> {
  return extractEmails(await getSetting('hdReport.alwaysBcc'));
}
const uniqEmails = (...lists: string[][]) => Array.from(new Set(lists.flat().map((e) => e.trim()).filter(Boolean)));

export interface WeeklySendSummary {
  week: string;
  national: 'sent' | 'skipped-sent-already' | 'no-recipients' | 'error';
  storesSent: number; storesSkipped: number; storesNoRecipients: number;
  recipients: number; errors: string[];
}

/**
 * Send the week's reports for real: the National summary + every active store
 * with recipients. Every address is BCC'd (To shows only reporter@). Idempotent
 * per week via HdWeeklyReportLog, so a cron re-run or a manual click can't
 * double-send.
 */
export async function sendWeeklyReports(week: Week): Promise<WeeklySendSummary> {
  const { from, replyTo } = weeklySenderIdentity();
  const weekStart = new Date(week.start); weekStart.setHours(0, 0, 0, 0);
  const extra = await alwaysBcc();
  const summary: WeeklySendSummary = { week: week.label, national: 'no-recipients', storesSent: 0, storesSkipped: 0, storesNoRecipients: 0, recipients: 0, errors: [] };

  // National
  let reservedNational = false; // true only while THIS call holds an unsent slot
  try {
    const bcc = uniqEmails(await getNationalRecipients(), extra);
    if (bcc.length === 0) summary.national = 'no-recipients';
    else {
      // Reserve the slot BEFORE sending: the unique (week,kind,store) index is
      // the lock, so two overlapping runs (cron + a manual click) can never both
      // deliver the same email. If the reservation loses the race, skip.
      reservedNational = await reserveSend(weekStart, 'NATIONAL', '', bcc.length);
      if (!reservedNational) summary.national = 'skipped-sent-already';
      else {
        const html = renderNationalEmailHtml(await assembleNational(week));
        const res = await sendEmail({ to: replyTo, bcc: bcc.join(','), subject: `Georgian Water and Air Weekly National Sales Update — ${week.label}`, html, from, replyTo });
        if (!res.sent) { summary.national = 'error'; summary.errors.push(`national: ${res.reason}`); }
        else { summary.national = 'sent'; summary.recipients += bcc.length; reservedNational = false; } // keep the row
      }
    }
  } catch (e) {
    summary.national = 'error'; summary.errors.push(`national: ${String(e)}`);
  } finally {
    // Any outcome other than a successful send releases the slot we claimed, so
    // the next run can retry. reserveSend failures never set the flag, so we
    // never delete a prior successful send's row.
    if (reservedNational) await releaseSend(weekStart, 'NATIONAL', '');
  }

  // Stores
  const reports = await assembleStoreReports(week);
  for (const r of reports) {
    if (!r.active) { summary.storesSkipped += 1; continue; }
    // A store must have its OWN external recipients (store/distributor/office/
    // ISM). Without them there is nobody at Home Depot to send to, so we do NOT
    // send (and do NOT log) — otherwise the week would be marked done and the
    // real report would be blocked once contacts are added for that store.
    if (uniqEmails(r.to, r.cc).length === 0) { summary.storesNoRecipients += 1; continue; }
    const bcc = uniqEmails(r.to, r.cc, extra);
    let reserved = false;
    try {
      reserved = await reserveSend(weekStart, 'STORE', r.storeNumber, bcc.length);
      if (!reserved) { summary.storesSkipped += 1; continue; }
      const res = await sendEmail({ to: replyTo, bcc: bcc.join(','), subject: 'Georgian Water and Air Weekly HD Sales Update', html: renderStoreEmailHtml(r), from, replyTo });
      if (!res.sent) { summary.errors.push(`${r.storeNumber}: ${res.reason}`); continue; }
      summary.storesSent += 1; summary.recipients += bcc.length; reserved = false; // keep the row
    } catch (e) {
      summary.errors.push(`${r.storeNumber}: ${String(e)}`);
    } finally {
      if (reserved) await releaseSend(weekStart, 'STORE', r.storeNumber);
    }
  }
  return summary;
}

/**
 * Atomically claim the (week, kind, store) send slot. Returns true if this call
 * won the slot (caller should send), false if it was already taken (duplicate —
 * caller must NOT send). A real DB error throws, so the caller treats it as an
 * error and does not send. The row is written first on purpose: if the write
 * fails we never send, which is the safe failure.
 */
async function reserveSend(weekStart: Date, kind: string, storeNumber: string, recipientCount: number): Promise<boolean> {
  try {
    await prisma.hdWeeklyReportLog.create({ data: { weekStart, kind, storeNumber, recipientCount } });
    return true;
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return false; // already reserved/sent
    throw e;
  }
}

/** Release a reservation when the send itself failed, so a later run can retry. */
async function releaseSend(weekStart: Date, kind: string, storeNumber: string): Promise<void> {
  await prisma.hdWeeklyReportLog.delete({ where: { weekStart_kind_storeNumber: { weekStart, kind, storeNumber } } }).catch(() => {});
}

/** Monday reminder: email internal staff if any 701 store leads still need an
 *  associate credited for the week. Recipients from hdReport.reminderTo. */
export async function sendAttributionReminder(week: Week): Promise<{ needing: number; sent: boolean }> {
  const leads = await listStoreLeadSales(week);
  const needing = leads.filter(leadNeedsAssociate).length;
  if (needing === 0) return { needing: 0, sent: false };
  const to = extractEmails(await getSetting('hdReport.reminderTo'));
  const list = to.length ? to : ['sean@ghsbarrie.ca'];
  const { from, replyTo } = weeklySenderIdentity();
  const url = appUrl();
  const html = `<p style="font-family:Arial,sans-serif;font-size:14px;color:#2c3e50;">${needing} Home Depot <b>store-lead (701)</b> sale${needing === 1 ? '' : 's'} for the week of <b>${week.label}</b> still need an associate credited before the store reports go out.</p>
  <p style="font-family:Arial,sans-serif;font-size:14px;"><a href="${url}/admin/weekly-reports/attribution" style="color:#1a5fa8;">Credit the associates →</a></p>`;
  const res = await sendEmail({ to: list.join(','), subject: `⚠ ${needing} store-lead${needing === 1 ? '' : 's'} need an associate — week of ${week.label}`, html, from, replyTo });
  return { needing, sent: res.sent };
}
