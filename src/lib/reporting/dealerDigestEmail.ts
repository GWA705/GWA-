import 'server-only';
import type { DealerDigest } from './dealerDigest';

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
