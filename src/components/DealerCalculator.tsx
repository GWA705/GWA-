'use client';

import { useEffect, useState, useTransition } from 'react';
import { Search, Printer, Copy, Check, Clock, User, X, FileDown } from 'lucide-react';
import { computeDealerPayout, PROVINCE_TAX_RATE, type PayoutBreakdown } from '@/lib/payoutCalc';
import { searchDealerDeals, type DealMatch } from '@/app/(dealer)/dealer/calculator/actions';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';

const PROVINCES = Object.keys(PROVINCE_TAX_RATE);
const money = (x: number) => `$${x.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (r: number) => `${(r * 100).toLocaleString('en-CA', { maximumFractionDigits: 3 })}%`;
const RECENT_KEY = 'gwa:calc-recent';

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Dealer payout calculator + printable sale/payout receipt.
 *
 * Enter an approved amount (or pull a portal deal) to see an accounting-grade
 * EFT payout breakdown. Picking a portal deal also captures the sale details
 * (customer, sale date, products, sales rep, installer, payment method) so the
 * dealer — or their accounting team — can print a receipt to attach to the sale.
 * Recently pulled deals are remembered per browser for quick re-access.
 */
export function DealerCalculator({ defaultProvince = 'ON' }: { defaultProvince?: string }) {
  const t = useT();
  const [amount, setAmount] = useState('');
  const [province, setProvince] = useState(PROVINCES.includes(defaultProvince) ? defaultProvince : 'ON');
  const [reference, setReference] = useState('');
  const [customer, setCustomer] = useState('');
  const [deal, setDeal] = useState<DealMatch | null>(null); // picked portal deal (sale details for the receipt)
  const [copied, setCopied] = useState(false);

  // Portal deal lookup.
  const [lookup, setLookup] = useState('');
  const [results, setResults] = useState<DealMatch[] | null>(null);
  const [searching, startSearch] = useTransition();

  // Recently pulled deals (per browser).
  const [recent, setRecent] = useState<DealMatch[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  function pushRecent(d: DealMatch) {
    setRecent((prev) => {
      const next = [d, ...prev.filter((x) => x.id !== d.id)].slice(0, 6);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  function clearRecent() {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
  }

  function runSearch() {
    const q = lookup.trim();
    if (q.length < 2) { setResults([]); return; }
    startSearch(async () => { setResults(await searchDealerDeals(q)); });
  }

  function pickDeal(d: DealMatch) {
    if (d.amount != null) setAmount(String(d.amount));
    if (PROVINCES.includes(d.province)) setProvince(d.province);
    setCustomer(d.name);
    setReference(d.reference || d.name);
    setDeal(d);
    setResults(null);
    setLookup('');
    pushRecent(d);
  }

  function clearDeal() {
    setDeal(null);
    setCustomer('');
    setReference('');
    setAmount('');
  }

  const n = Number(amount.replace(/[^0-9.]/g, ''));
  const r = n > 0 ? computeDealerPayout(n, province) : null;

  function copyBreakdown() {
    if (!r?.ok) return;
    const lines = [
      'Georgian Water & Air — Dealer Payout Breakdown',
      customer ? `Customer: ${customer}` : null,
      reference ? `Reference: ${reference}` : null,
      `Province: ${r.province} (tax ${pct(r.taxRate)})`,
      '',
      `Total sale (with tax):        ${money(r.totalWithTax)}`,
      `Subtotal (pre-tax):           ${money(r.subtotal)}`,
      `HD Discount (13%):           -${money(r.hdDiscount)}`,
      `Subtotal after HD Discount:   ${money(r.afterHd)}`,
      `HD IBX Discount (1.25%):     -${money(r.ibxDiscount)}`,
      `Subtotal after IBX Discount:  ${money(r.afterIbx)}`,
      `HD Program (4%):             -${money(r.hdProgram)}`,
      `Net payout (pre-tax):         ${money(r.netPreTax)}`,
      `HST/Tax (${pct(r.taxRate)}):              +${money(r.hst)}`,
      `TOTAL EFT PAYOUT:             ${money(r.payout)}`,
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const [savingPdf, setSavingPdf] = useState(false);
  async function savePdf() {
    if (!r?.ok || savingPdf) return;
    setSavingPdf(true);
    try {
      const res = await fetch('/api/dealer/calculator/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: n,
          province,
          customer,
          reference,
          saleDate: fmtDate(deal?.saleDate ?? null) ?? undefined,
          products: deal?.products.length ? deal.products.join(', ') : undefined,
          salesperson: deal?.salesperson ?? undefined,
          installer: deal?.installer ?? undefined,
          paymentLabel: deal?.paymentLabel ?? undefined,
        }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gwa-payout-${(customer || reference || 'receipt').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      /* ignore */
    } finally {
      setSavingPdf(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        {/* Left column: find a deal + inputs + result */}
        <div className="space-y-4">
          {/* Portal deal lookup */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="label" htmlFor="calc-lookup">{t('calculator.findDeal')} <span className="font-normal text-gray-400">{t('calculator.findDealHint')}</span></label>
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3">
                <Search size={16} className="flex-none text-gray-400" />
                <input
                  id="calc-lookup"
                  className="w-full bg-transparent py-2.5 text-sm outline-none"
                  placeholder={t('calculator.lookupPlaceholder')}
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
                  autoComplete="off"
                />
              </div>
              <button type="button" onClick={runSearch} className="btn-secondary" disabled={searching}>
                {searching ? t('calculator.searching') : t('calculator.search')}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">{t('calculator.pullsFromDeals')}</p>

            {/* Search results — refined customer cards */}
            {results && (
              <div className="mt-3 space-y-2">
                {results.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-500">{t('calculator.noMatches')}</div>
                ) : (
                  results.map((d) => <DealCard key={d.id} deal={d} onPick={pickDeal} t={t} />)
                )}
              </div>
            )}

            {/* Recent searches — quick re-pick */}
            {!results && recent.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    <Clock size={12} /> {t('calculator.recent')}
                  </span>
                  <button type="button" onClick={clearRecent} className="text-xs text-gray-400 hover:text-red-600">{t('calculator.clear')}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => pickDeal(d)}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-sm shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                      title={d.reference ? `#${d.reference}` : undefined}
                    >
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">{initialsOf(d.name)}</span>
                      <span className="truncate font-medium text-gray-800">{d.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Inputs */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {deal ? (
              <SelectedDealCard deal={deal} onClear={clearDeal} t={t} />
            ) : customer ? (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-sm">
                <span className="text-sky-800">{t('calculator.customerLabel')} <strong>{customer}</strong></span>
                <button type="button" onClick={() => setCustomer('')} className="text-xs text-gray-500 hover:underline">{t('calculator.clearLower')}</button>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <div>
                <label className="label" htmlFor="calc-amount">{t('calculator.approvedAmount')} <span className="font-normal text-gray-400">{t('calculator.approvedAmountHint')}</span></label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-gray-300">$</span>
                  <input
                    id="calc-amount"
                    inputMode="decimal"
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-2xl font-bold tabular-nums text-gray-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="calc-prov">{t('calculator.province')}</label>
                <select id="calc-prov" className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 px-3 text-lg font-semibold text-gray-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100" value={province} onChange={(e) => setProvince(e.target.value)}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">{t('calculator.provinceHint')}</p>
            <div className="mt-4">
              <label className="label" htmlFor="calc-ref">{t('calculator.reference')} <span className="font-normal text-gray-400">{t('calculator.referenceHint')}</span></label>
              <input id="calc-ref" className="input" placeholder={t('calculator.referencePlaceholder')} value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
            </div>
          </div>

          {/* Result — stays on the left, under the inputs */}
          {r?.ok && (
            <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              <div className="relative px-6 py-7 text-center text-white" style={{ background: 'linear-gradient(135deg,#0f7a4d,#1aa06a)' }}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {t('calculator.estimatedPayout')}{customer ? ` · ${customer}` : ''}
                </div>
                <div className="mt-1 text-4xl font-extrabold tabular-nums sm:text-5xl">{money(r.payout)}</div>
                <div className="mt-1 text-sm text-white/70">
                  {r.province} · tax {pct(r.taxRate)}{reference ? ` · ${reference}` : ''}
                </div>
              </div>
              <div className="bg-white">
                <div className="flex items-center justify-between px-5 pt-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t('calculator.howCalculated')}</span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={copyBreakdown} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50">
                      {copied ? <><Check size={13} className="text-green-600" /> {t('calculator.copied')}</> : <><Copy size={13} /> {t('calculator.copy')}</>}
                    </button>
                    <button type="button" onClick={savePdf} disabled={savingPdf} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60">
                      <FileDown size={13} /> {savingPdf ? t('calculator.saving') : t('calculator.savePdf')}
                    </button>
                    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-sky-700">
                      <Printer size={13} /> {t('calculator.printReceipt')}
                    </button>
                  </div>
                </div>
                <BreakdownTable r={r} t={t} />
                {r.warning && <p className="border-t border-gray-100 px-5 py-2 text-xs text-amber-700">{r.warning}</p>}
              </div>
            </div>
          )}
        </div>{/* end left column */}

        {/* Right column: the explanation — always shown, even with numbers in. */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <HowItWorks t={t} />
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">
        {t('calculator.disclaimer')}
      </p>

      {/* Printable receipt (hidden on screen) */}
      {r?.ok && (
        <Receipt r={r} customer={customer} reference={reference} deal={deal} />
      )}
    </div>
  );
}

/* ---- Refined search-result "customer profile" card ---- */
function DealCard({ deal, onPick, t }: { deal: DealMatch; onPick: (d: DealMatch) => void; t: TFunction }) {
  const disabled = deal.amount == null;
  return (
    <button
      type="button"
      onClick={() => onPick(deal)}
      disabled={disabled}
      title={disabled ? t('calculator.noAmountYet') : t('calculator.useThisDeal')}
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">{initialsOf(deal.name)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">{deal.name || t('calculator.noName')}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{deal.statusLabel}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-gray-400">
          {[deal.reference && `#${deal.reference}`, deal.province, deal.products[0], fmtDate(deal.saleDate)].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-800">
        {deal.amount != null ? money(deal.amount) : t('calculator.noAmount')}
      </span>
    </button>
  );
}

/* ---- Selected deal summary (customer profile) shown above the inputs ---- */
function SelectedDealCard({ deal, onClear, t }: { deal: DealMatch; onClear: () => void; t: TFunction }) {
  const rows: [string, string | null][] = [
    [t('calculator.saleDate'), fmtDate(deal.saleDate)],
    [t('calculator.productsRow'), deal.products.length ? deal.products.join(', ') : null],
    [t('calculator.salesRep'), deal.salesperson],
    [t('calculator.installer'), deal.installer],
    [t('calculator.payment'), deal.paymentLabel],
  ];
  const shown = rows.filter(([, v]) => v);
  return (
    <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">{initialsOf(deal.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <User size={13} className="flex-none text-sky-600" />
            <span className="truncate text-sm font-bold text-[#0e2b5c]">{deal.name}</span>
          </div>
          {deal.reference && <div className="text-xs text-sky-700">#{deal.reference}</div>}
        </div>
        <button type="button" onClick={onClear} aria-label={t('calculator.clearDeal')} className="flex-none rounded-md p-1 text-gray-400 hover:bg-white hover:text-red-600"><X size={15} /></button>
      </div>
      {shown.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
          {shown.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 text-xs sm:block">
              <dt className="font-semibold uppercase tracking-wide text-sky-700/70">{k}</dt>
              <dd className="truncate text-sky-900">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ---- Shared breakdown table (screen + print) ---- */
function BreakdownTable({ r, t }: { r: PayoutBreakdown; t: TFunction }) {
  return (
    <table className="w-full text-sm">
      <tbody className="tabular-nums">
        <Line label={t('calculator.totalSale')} value={money(r.totalWithTax)} />
        <Line label={t('calculator.subtotalPreTax')} value={money(r.subtotal)} muted />
        <Line label={t('calculator.hdDiscount')} value={`−${money(r.hdDiscount)}`} minus />
        <Line label={t('calculator.afterHd')} value={money(r.afterHd)} muted />
        <Line label={t('calculator.ibxDiscount')} value={`−${money(r.ibxDiscount)}`} minus />
        <Line label={t('calculator.afterIbx')} value={money(r.afterIbx)} muted />
        <Line label={t('calculator.hdProgram')} value={`−${money(r.hdProgram)}`} minus />
        <Line label={t('calculator.netPreTax')} value={money(r.netPreTax)} strong />
        <Line label={t('calculator.hstTax', { rate: pct(r.taxRate) })} value={`+${money(r.hst)}`} plus />
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-emerald-100 bg-emerald-50">
          <td className="px-5 py-3 text-sm font-semibold text-emerald-800">{t('calculator.totalPayout')}</td>
          <td className="px-5 py-3 text-right text-lg font-bold tabular-nums text-emerald-800">{money(r.payout)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/* ---- Printable receipt (hidden on screen; shown by @media print) ---- */
function Receipt({
  r, customer, reference, deal,
}: {
  r: PayoutBreakdown;
  customer: string;
  reference: string;
  deal: DealMatch | null;
}) {
  const details: [string, string | null][] = [
    ['Customer', customer || null],
    ['Date of sale', fmtDate(deal?.saleDate ?? null)],
    ['Reference / deal #', reference || null],
    ['Products sold', deal?.products.length ? deal.products.join(', ') : null],
    ['Sales rep', deal?.salesperson ?? null],
    ['Installer', deal?.installer ?? null],
    ['Payment method', deal?.paymentLabel ?? null],
    ['Province', r.province],
  ];
  const shown = details.filter(([, v]) => v);
  return (
    <div className="print-only" style={{ padding: '24px', color: '#111', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderBottom: '2px solid #0e2b5c', paddingBottom: '10px', marginBottom: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#0e2b5c' }}>Georgian Water &amp; Air</div>
        <div style={{ fontSize: '13px', color: '#555' }}>Dealer Sale &amp; Payout Receipt</div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Printed {new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <table style={{ width: '100%', fontSize: '13px', marginBottom: '18px', borderCollapse: 'collapse' }}>
        <tbody>
          {shown.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: '3px 0', color: '#666', width: '38%', verticalAlign: 'top' }}>{k}</td>
              <td style={{ padding: '3px 0', fontWeight: 600 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#666', marginBottom: '4px' }}>Payout breakdown</div>
      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
        <tbody>
          {[
            ['Total sale (with tax)', money(r.totalWithTax)],
            ['Subtotal (pre-tax)', money(r.subtotal)],
            ['HD Discount (13%)', `−${money(r.hdDiscount)}`],
            ['Subtotal after HD Discount', money(r.afterHd)],
            ['HD IBX Discount (1.25%)', `−${money(r.ibxDiscount)}`],
            ['Subtotal after IBX Discount', money(r.afterIbx)],
            ['HD Program (4%)', `−${money(r.hdProgram)}`],
            ['Net payout (pre-tax)', money(r.netPreTax)],
            [`HST / Tax (${pct(r.taxRate)})`, `+${money(r.hst)}`],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '4px 0', color: '#444' }}>{k}</td>
              <td style={{ padding: '4px 0', textAlign: 'right' }}>{v}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #0f7a4d' }}>
            <td style={{ padding: '6px 0', fontWeight: 800, color: '#0f7a4d' }}>TOTAL EFT PAYOUT</td>
            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 800, color: '#0f7a4d' }}>{money(r.payout)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: '10px', color: '#999', marginTop: '18px' }}>
        Estimate for your records. The amount paid is confirmed by Georgian Water &amp; Air when the deal funds.
      </p>
    </div>
  );
}

/* ---- Persistent explanation ---- */
function HowItWorks({ t }: { t: TFunction }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">{t('calculator.howItWorksEyebrow')}</div>
      <h3 className="mt-1 text-lg font-bold text-[#0e2b5c] dark:text-slate-100">{t('calculator.howItWorksTitle')}</h3>
      <p className="mt-1 text-sm text-gray-500">{t('calculator.howItWorksIntro')}</p>
      <ol className="mt-4 space-y-3">
        <Step n="1" title={t('calculator.step1Title')} body={t('calculator.step1Body')} />
        <Step n="2" title={t('calculator.step2Title')} body={t('calculator.step2Body')} />
        <Step n="3" title={t('calculator.step3Title')} body={t('calculator.step3Body')} />
        <Step n="4" title={t('calculator.step4Title')} body={t('calculator.step4Body')} />
        <Step n="5" title={t('calculator.step5Title')} body={t('calculator.step5Body')} />
        <Step n="6" title={t('calculator.step6Title')} body={t('calculator.step6Body')} />
      </ol>
      <p className="mt-4 rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
        {t('calculator.tipPre')} <strong>{t('calculator.tipFindDeal')}</strong> {t('calculator.tipMid')} <strong>{t('calculator.tipPrint')}</strong> {t('calculator.tipPost')}
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{n}</span>
      <div>
        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</div>
        <div className="text-xs text-gray-500">{body}</div>
      </div>
    </li>
  );
}

function Line({ label, value, muted, strong, minus, plus }: { label: string; value: string; muted?: boolean; strong?: boolean; minus?: boolean; plus?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className={`px-5 py-2.5 ${strong ? 'font-semibold text-gray-900' : muted ? 'text-gray-500' : 'text-gray-700'}`}>{label}</td>
      <td className={`px-5 py-2.5 text-right ${minus ? 'text-red-600' : plus ? 'text-emerald-700' : strong ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{value}</td>
    </tr>
  );
}
