import 'server-only';
import type { DealerDigest } from './dealerDigest';
import type { DigestFlyer } from '@/lib/settings';

/**
 * The digest email body (fragment passed to renderEmail's bodyHtml). All
 * table-based and inline-styled so it renders in every mail client (no flexbox,
 * grid, web fonts, SVG or JS). Palette stays within the email BRAND blue
 * (#1d4ed8) + greyscale + the existing up/down green/red — no new brand colours.
 */

const BRAND = '#1d4ed8';
const BRAND_SOFT = '#eef4ff';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

/** A small coloured delta pill (▲/▼ %, "New", or "no change"). */
function deltaPill(pct: number | null): string {
  let bg = '#f3f4f6';
  let fg = '#6b7280';
  let text = 'no change';
  if (pct == null) {
    bg = BRAND_SOFT; fg = BRAND; text = 'New';
  } else if (pct !== 0) {
    const up = pct > 0;
    bg = up ? '#ecfdf5' : '#fef2f2';
    fg = up ? '#059669' : '#dc2626';
    text = `${up ? '▲' : '▼'} ${Math.abs(pct)}%`;
  }
  return `<span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;">${text}</span>`;
}

/** One big-number KPI tile. `accent` makes it the hero (money) tile. */
function tile(label: string, value: string, sub: string, accent = false): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${accent ? BRAND_SOFT : '#f9fafb'};border:1px solid ${accent ? '#dbe6ff' : '#eef2f7'};border-radius:10px;">
    <tr><td style="padding:12px 14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af;">${esc(label)}</div>
      <div style="font-size:24px;font-weight:800;line-height:1.1;color:${accent ? BRAND : '#111827'};margin-top:5px;font-variant-numeric:tabular-nums;">${value}</div>
      ${sub ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">${sub}</div>` : '<div style="height:4px;"></div>'}
    </td></tr>
  </table>`;
}

/** Table-based vertical bar sparkline of the last periods' lead totals. */
function sparkline(d: DealerDigest): string {
  const pts = d.trend.filter((p) => p && typeof p.total === 'number');
  if (pts.length < 2) return '';
  const max = Math.max(1, ...pts.map((p) => p.total));
  const MAXPX = 56;
  const bars = pts
    .map((p, i) => {
      const h = Math.max(3, Math.round((p.total / max) * MAXPX));
      const last = i === pts.length - 1;
      return `<td valign="bottom" align="center" style="padding:0 2px;">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;font-variant-numeric:tabular-nums;">${p.total}</div>
        <div style="width:18px;height:${h}px;background:${last ? BRAND : '#c7d2fe'};border-radius:3px 3px 0 0;margin:0 auto;"></div>
      </td>`;
    })
    .join('');
  const labels = pts
    .map((p) => `<td align="center" style="font-size:9px;color:#9ca3af;padding-top:4px;">${esc(p.label)}</td>`)
    .join('');
  return `<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af;margin:4px 0 8px;">Leads — last ${pts.length} ${d.period === 'week' ? 'weeks' : 'months'}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
      <tr style="height:${MAXPX + 18}px;">${bars}</tr>
      <tr>${labels}</tr>
    </table>`;
}

function sectionRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#6b7280;">${esc(label)}</td>
    <td style="padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#111827;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;">${value}</td>
  </tr>`;
}

function section(title: string, rows: string): string {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${BRAND};margin:0 0 2px;">${esc(title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;">${rows}</table>`;
}

export function renderDigestBodyHtml(d: DealerDigest): string {
  const contactedPct = d.leads.total ? ` · ${Math.round((d.leads.contacted / d.leads.total) * 100)}% contacted` : '';
  const ratingVal = d.voc.avgRating != null ? d.voc.avgRating.toFixed(2) : '—';
  const stars = d.voc.avgRating != null ? '★'.repeat(Math.round(d.voc.avgRating)) + '☆'.repeat(5 - Math.round(d.voc.avgRating)) : '';

  // KPI hero — four big numbers, money as the accented hero.
  const tiles = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
    <tr>
      <td width="50%" valign="top" style="padding:0 5px 10px 0;">${tile('Funded', money(d.financing.fundedTotal), `${d.financing.fundedDeals} deal${d.financing.fundedDeals === 1 ? '' : 's'} paid`, true)}</td>
      <td width="50%" valign="top" style="padding:0 0 10px 5px;">${tile('Leads', String(d.leads.total), deltaPill(d.leads.deltaPct) + contactedPct)}</td>
    </tr>
    <tr>
      <td width="50%" valign="top" style="padding:0 5px 0 0;">${tile('Booked / sold', String(d.leads.bookedSold), `${d.financing.okDeals} deal${d.financing.okDeals === 1 ? '' : 's'} written`)}</td>
      <td width="50%" valign="top" style="padding:0 0 0 5px;">${tile('Avg rating', ratingVal, stars ? `<span style="color:#f59e0b;letter-spacing:1px;">${stars}</span> · ${d.voc.completed} VOC${d.voc.completed === 1 ? '' : 's'}` : `${d.voc.completed} VOC${d.voc.completed === 1 ? '' : 's'}`)}</td>
    </tr>
  </table>`;

  const highlights = d.highlights.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
        <tr><td style="background:${BRAND_SOFT};border-left:3px solid ${BRAND};border-radius:0 8px 8px 0;padding:11px 14px;">
          ${d.highlights.map((h) => `<div style="font-size:13px;color:#0e2756;line-height:1.55;">• ${esc(h)}</div>`).join('')}
        </td></tr>
      </table>`
    : '';

  const financing = section('Financing', [
    sectionRow('Funded this period', `${money(d.financing.fundedTotal)} (${d.financing.fundedDeals} paid)`),
    sectionRow('Financed (loans)', `${d.financing.financed} · FinanceIt ${d.financing.financeIt}`),
    sectionRow('HD Credit Cards', String(d.financing.hdCreditCards)),
    sectionRow('Cash / other', String(d.financing.cashOther)),
  ].join(''));

  const leads = section('Leads', [
    sectionRow('Received', `${d.leads.total} &nbsp; ${deltaPill(d.leads.deltaPct)}`),
    sectionRow('Contacted', `${d.leads.contacted}${d.leads.total ? ` (${Math.round((d.leads.contacted / d.leads.total) * 100)}%)` : ''}`),
    sectionRow('Booked / sold', String(d.leads.bookedSold)),
    sectionRow('No good', String(d.leads.noGood)),
  ].join(''));

  const voc = section('Voice of the Customer', [
    sectionRow('VOCs completed', String(d.voc.completed)),
    sectionRow('Avg rating', ratingVal),
    ...(d.voc.topReps.length ? [sectionRow('Top rep', `${esc(d.voc.topReps[0].rep)} (${d.voc.topReps[0].count})`)] : []),
  ].join(''));

  return `${tiles}${sparkline(d)}${highlights}${leads}${financing}${voc}`;
}

/** The "What's new in the portal" flyer block (admin-added announcement). */
function renderFlyer(f: DigestFlyer, appUrl: string): string {
  const img = f.imageKey
    ? `<tr><td style="font-size:0;line-height:0;"><img src="${appUrl}/api/digest/flyer-image?v=${encodeURIComponent(f.imageKey)}" alt="${esc(f.title || 'Announcement')}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;"></td></tr>`
    : '';
  const btn = f.buttonLabel && f.buttonUrl
    ? `<a href="${esc(f.buttonUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 18px;border-radius:8px;">${esc(f.buttonLabel)}</a>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 4px;border:1px solid #e8edf4;border-radius:12px;overflow:hidden;">
    ${img}
    <tr><td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#f96302;font-weight:800;">What's new in the portal</div>
      ${f.title ? `<div style="font-size:16px;font-weight:800;color:#0f172a;margin:4px 0 6px;">${esc(f.title)}</div>` : ''}
      ${f.blurb ? `<div style="font-size:13px;color:#475569;line-height:1.55;margin:0 0 ${btn ? '12px' : '0'};">${esc(f.blurb)}</div>` : ''}
      ${btn}
    </td></tr>
  </table>`;
}

export interface DigestEmailOpts { appUrl: string; flyer?: DigestFlyer | null; isTest?: boolean }

/**
 * The full dealer-snapshot email — co-branded masthead (GWA + HD Home Services
 * logos), a portal-style hero pill, the stats body, an optional "What's new"
 * flyer, and a footer. Table-based + inline CSS for mail-client compatibility.
 */
export function renderDigestEmail(d: DealerDigest, opts: DigestEmailOpts): string {
  const appUrl = opts.appUrl.replace(/\/$/, '');
  const label = d.period === 'week' ? 'Weekly' : 'Monthly';
  const intro = `Here's how ${esc(d.office)} did this ${d.period === 'week' ? 'week' : 'month'}${opts.isTest ? ' (test preview)' : ''} — your numbers at a glance${opts.flyer ? ", plus what's new in the portal" : ''}.`;
  const body = renderDigestBodyHtml(d);
  const flyerHtml = opts.flyer ? renderFlyer(opts.flyer, appUrl) : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#eef1f6;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td align="center" style="background:#ffffff;padding:22px 24px 8px;">
          <img src="${appUrl}/gwa-hd-logos.png" alt="Georgian Water &amp; Air · Authorized Home Depot Home Services Installer" width="300" style="display:block;width:300px;max-width:84%;height:auto;border:0;margin:0 auto;">
        </td></tr>
        <tr><td style="background:#ffffff;padding:4px 20px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#0f2350;background-image:linear-gradient(135deg,#0f2350,#1d4ed8);border-radius:14px 14px 0 0;padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#ffffff;">${label} Dealer Snapshot</td>
                <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c3d4ff;white-space:nowrap;">${esc(d.periodLabel)}</td>
              </tr></table>
            </td></tr>
            <tr><td style="font-size:0;line-height:0;"><div style="height:4px;background:#f96302;border-radius:0 0 10px 10px;"></div></td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#ffffff;padding:4px 24px 10px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:14px;line-height:1.6;">
          <p style="margin:0 0 16px;">${intro}</p>
          ${body}
          ${flyerHtml}
        </td></tr>
        <tr><td style="background:#0f172a;padding:20px 24px;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;">
          <div style="color:#ffffff;font-weight:700;font-size:13px;">Georgian Water &amp; Air · Dealer Portal</div>
          <div>You're receiving this snapshot because you're an office admin.</div>
          <div style="margin-top:8px;"><a href="${appUrl}/dealer/reports/digest?p=${d.period}" style="color:#9db6ff;text-decoration:none;font-weight:600;">Open the full report →</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
