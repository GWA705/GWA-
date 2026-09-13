import 'server-only';
import type { DealerDigest } from './dealerDigest';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

function deltaText(pct: number | null): string {
  if (pct == null) return '<span style="color:#2563eb;">New</span>';
  if (pct === 0) return '<span style="color:#9ca3af;">no change</span>';
  const up = pct > 0;
  return `<span style="color:${up ? '#059669' : '#dc2626'};">${up ? '▲' : '▼'} ${Math.abs(pct)}%</span>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 10px;border-bottom:1px solid #eef2f7;font-size:13px;color:#6b7280;">${esc(label)}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eef2f7;font-size:14px;color:#111827;font-weight:600;text-align:right;">${value}</td>
  </tr>`;
}

/** The digest email body (fragment passed to renderEmail's bodyHtml). Plain,
 * table-based, inline-styled so it renders in every mail client. */
export function renderDigestBodyHtml(d: DealerDigest): string {
  const highlights = d.highlights.length
    ? `<ul style="margin:0 0 14px;padding-left:18px;font-size:14px;color:#0e2756;">${d.highlights
        .map((h) => `<li style="margin:2px 0;">${esc(h)}</li>`)
        .join('')}</ul>`
    : '';

  const leads = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px;border-collapse:collapse;">
    <tr><td colspan="2" style="padding:2px 10px 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af;">Leads</td></tr>
    ${row('Leads received', `${d.leads.total} &nbsp; ${deltaText(d.leads.deltaPct)}`)}
    ${row('Contacted', `${d.leads.contacted}${d.leads.total ? ` (${Math.round((d.leads.contacted / d.leads.total) * 100)}%)` : ''}`)}
    ${row('Booked / sold', String(d.leads.bookedSold))}
    ${row('No good', String(d.leads.noGood))}
  </table>`;

  const financing = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px;border-collapse:collapse;">
    <tr><td colspan="2" style="padding:2px 10px 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af;">Financing</td></tr>
    ${row('Funded this period', `${money(d.financing.fundedTotal)} (${d.financing.fundedDeals} paid)`)}
    ${row('Financed (loans)', `${d.financing.financed} · FinanceIt ${d.financing.financeIt}`)}
    ${row('HD Credit Cards', String(d.financing.hdCreditCards))}
    ${row('Cash / other', String(d.financing.cashOther))}
  </table>`;

  const voc = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px;border-collapse:collapse;">
    <tr><td colspan="2" style="padding:2px 10px 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af;">Voice of the Customer</td></tr>
    ${row('VOCs completed', String(d.voc.completed))}
    ${row('Avg rating', d.voc.avgRating != null ? d.voc.avgRating.toFixed(2) : '—')}
    ${d.voc.topReps.length ? row('Top rep', `${esc(d.voc.topReps[0].rep)} (${d.voc.topReps[0].count})`) : ''}
  </table>`;

  return `${highlights}${leads}${financing}${voc}`;
}
