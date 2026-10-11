import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, User, CreditCard, Camera, Flag, Clock, Phone,
  CheckCircle2, Check, Circle, FileText, ShieldCheck, Mail, Paperclip, MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { loadResolutionCase } from '@/lib/resolutionCases';
import { loadCustomerCalls } from '@/lib/customerCalls';
import { STATUS_LABEL, statusChipClass } from '@/lib/resolutionStatus';
import { formatPhoneDisplay } from '@/lib/format';
import { DocViewer } from '@/components/DocViewer';
import { CaseControls } from '../CaseControls';
import { CaseAttachments } from '../CaseAttachments';
import { CaseEmailThread } from '../CaseEmailThread';
import { CaseContactCard } from '../CaseContactCard';
import { LinkDealControl } from '../LinkDealControl';
import { HdReplyDrafter } from '../HdReplyDrafter';
import { WatchEmailsControl } from '../WatchEmailsControl';
import { gmailResolutionConfigured } from '@/lib/gmailResolution';
import { aiConfigured } from '@/lib/ai';

const TEXT_KIND_LABEL: Record<string, string> = {
  CONFIRM: 'Confirmation text', DAY1: 'Day-1 reminder', MISSED_WINDOW: 'Missed-window text', REACTIVATION: 'Reactivation text',
};

export const dynamic = 'force-dynamic';

/** A card section with an icon header — the repeated building block of the file. */
function Section({
  icon: Icon, title, meta, children, accent = false,
}: {
  icon: LucideIcon;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border shadow-sm ${accent ? 'border-brand-200 bg-brand-50/40 dark:border-sky-900/50 dark:bg-sky-950/20' : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-3.5 dark:border-slate-700">
        <Icon size={17} className="text-brand-600 dark:text-sky-400" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h2>
        {meta != null && <div className="ml-auto text-xs text-gray-400 dark:text-slate-500">{meta}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-slate-100">{children}</div>
    </div>
  );
}

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  await requireRole('REVIEWER', 'ADMIN');
  const c = await loadResolutionCase(params.id);
  if (!c) notFound();

  const staff = await prisma.user.findMany({
    where: { role: { in: ['REVIEWER', 'ADMIN'] }, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  // Calls & texts history for this customer (by deal + normalized phone).
  const last10 = (c.customerPhone || '').replace(/\D/g, '').slice(-10);
  const [callSnap, texts] = await Promise.all([
    c.applicationId ? loadCustomerCalls(c.applicationId, c.customerPhone) : Promise.resolve(null),
    last10
      ? prisma.leadTextOutbox.findMany({
          where: { phone: { endsWith: last10 }, status: 'SENT' },
          orderBy: { sentAt: 'desc' },
          take: 8,
          select: { leadKey: true, kind: true, channel: true, sentAt: true },
        })
      : Promise.resolve([]),
  ]);
  const hasComms = (callSnap && callSnap.calls.length > 0) || texts.length > 0;

  const { deal, installPhotos, docChecklist } = c.file;
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: 'Office', value: c.officeName },
    ...(deal?.installDate ? [{ label: 'Installed', value: deal.installDate }] : []),
    ...(deal?.productsSummary ? [{ label: 'Product', value: deal.productsSummary }] : deal ? [{ label: 'Program', value: deal.program }] : []),
    ...(deal ? [{ label: 'Deal', value: deal.status }] : []),
  ];

  return (
    <div className="max-w-5xl space-y-4">
      <Link href="/staff/resolutions" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 dark:text-slate-400">
        <ArrowLeft size={15} /> Resolution queue
      </Link>

      {/* Header band */}
      <header className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm dark:bg-slate-950 dark:ring-1 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>Case <b className="font-semibold text-slate-100">{c.caseNumber}</b></span>
          <span>·</span>
          <span>Opened <b className="font-semibold text-slate-100">{c.openedAt}</b> by <b className="font-semibold text-slate-100">{c.openedBy}</b></span>
          {c.hdReference && (<><span>·</span><span>HD Ref <b className="font-semibold text-slate-100">{c.hdReference}</b></span></>)}
          {c.hdCaseNumber && (<><span>·</span><span>HD Case <b className="font-semibold text-slate-100">#{c.hdCaseNumber}</b></span></>)}
        </div>
        <h1 className="mt-2 text-xl font-semibold leading-snug text-white">{c.title}</h1>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm">
            <span className="text-slate-400">Customer</span>
            {c.applicationId ? (
              <Link href={`/staff/find-customer/${c.applicationId}`} className="font-medium text-sky-200 hover:underline">{c.customerName}</Link>
            ) : <span className="font-medium">{c.customerName}</span>}
          </span>
          {facts.map((f) => (
            <span key={f.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm">
              <span className="text-slate-400">{f.label}</span> <span className="font-medium">{f.value}</span>
            </span>
          ))}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_312px]">
        {/* MAIN COLUMN */}
        <main className="space-y-4">
          {/* Customer */}
          <Section icon={User} title="Customer">
            <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
              <Field label="Name">{c.customerName}</Field>
              {c.customerPhone && <Field label="Phone">{formatPhoneDisplay(c.customerPhone)}</Field>}
              {c.customerEmail && <Field label="Email">{c.customerEmail}</Field>}
              {c.customerAddress && <Field label="Address">{c.customerAddress}</Field>}
              {c.spouseName && <Field label="Co-applicant">{c.spouseName}{c.spousePhone ? ` · ${formatPhoneDisplay(c.spousePhone)}` : ''}</Field>}
            </div>
          </Section>

          {/* Link prompt when no deal is linked */}
          {!c.applicationId && <LinkDealControl caseId={c.id} />}

          {/* Deal & financing */}
          {deal && (
            <Section icon={CreditCard} title="The deal & financing" meta={deal.status}>
              <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
                <Field label="Program">{deal.program}</Field>
                {deal.productsSummary && <Field label="Product">{deal.productsSummary}</Field>}
                {deal.saleDate && <Field label="Sale date">{deal.saleDate}</Field>}
                {deal.installDate && <Field label="Install date">{deal.installDate}</Field>}
                {deal.amount && <Field label="Amount">{deal.amount}</Field>}
                {deal.financeCompany && <Field label="Finance company">{deal.financeCompany}{deal.financeNumber ? ` · ${deal.financeNumber}` : ''}</Field>}
                {deal.storeLabel && <Field label="HD store">{deal.storeLabel}</Field>}
              </div>
              {deal.financingVerified && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300">
                  <ShieldCheck size={16} /> Financing number verified
                </div>
              )}
            </Section>
          )}

          {/* Install photos */}
          {c.applicationId && (
            <Section icon={Camera} title="Install photos" meta={installPhotos.length > 0 ? `${installPhotos.length} on file` : undefined}>
              {installPhotos.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">No install photos on the linked deal.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {installPhotos.map((p) => (
                    <DocViewer key={p.id} id={p.id} fileName={p.label} mimeType={p.mime} title={p.label} className="group block overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/documents/${p.id}/thumb`} alt={p.label} className="aspect-[4/3] w-full bg-gray-100 object-cover transition group-hover:opacity-90 dark:bg-slate-700" />
                    </DocViewer>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Documents on file */}
          {c.applicationId && (
            <Section icon={FileText} title="Documents on file" meta={`${docChecklist.filter((d) => d.verified).length} of ${docChecklist.length} verified`}>
              <div className="grid gap-2 sm:grid-cols-2">
                {docChecklist.map((d) => (
                  <div key={d.label} className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-slate-50/60 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                    {d.verified ? <CheckCircle2 size={17} className="shrink-0 text-green-600" />
                      : d.present ? <Check size={17} className="shrink-0 text-amber-600" />
                      : <Circle size={17} className="shrink-0 text-gray-300 dark:text-slate-600" />}
                    <span className="flex-1 text-gray-800 dark:text-slate-200">{d.label}</span>
                    <span className={`text-[11px] font-medium ${d.verified ? 'text-green-600' : d.present ? 'text-amber-600' : 'text-gray-400 dark:text-slate-500'}`}>
                      {d.verified ? 'Verified' : d.present ? 'On file' : 'Not on file'}
                    </span>
                  </div>
                ))}
              </div>
              {c.dealDocs.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
                  {c.dealDocs.map((d) => (
                    <DocViewer key={d.id} id={d.id} fileName={d.label} mimeType={d.mime} title={d.label}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      <FileText size={13} /> {d.label}
                    </DocViewer>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Problem */}
          <Section icon={Flag} title="The problem">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-slate-200">{c.description}</p>
          </Section>

          {/* Contacts (editable) */}
          <CaseContactCard
            caseId={c.id}
            applicationId={c.applicationId}
            customerName={c.customerName}
            customerPhone={c.customerPhone}
            customerEmail={c.customerEmail}
            customerAddress={c.customerAddress}
            spouseName={c.spouseName}
            spousePhone={c.spousePhone}
            hdRepName={c.hdRepName}
            hdRepPhone={c.hdRepPhone}
            hdRepEmail={c.hdRepEmail}
            extraContacts={c.extraContacts}
          />

          {/* HD email thread */}
          <Section icon={Mail} title="Email thread" meta={c.emailSyncedAt ? `Synced ${c.emailSyncedAt}` : undefined}>
            <CaseEmailThread
              caseId={c.id}
              configured={gmailResolutionConfigured()}
              linked={c.emailLinked}
              syncedAt={c.emailSyncedAt}
              emails={c.emails}
            />
            {gmailResolutionConfigured() && (
              <WatchEmailsControl caseId={c.id} watchEmails={c.watchEmails} customerEmail={c.customerEmail} />
            )}
          </Section>

          {/* Calls & texts history */}
          {hasComms && (
            <Section icon={Phone} title="Calls & texts"
              meta={callSnap && callSnap.total > 0 ? `${callSnap.total} call${callSnap.total === 1 ? '' : 's'} on record` : undefined}>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {callSnap?.calls.map((call) => (
                  <div key={call.id} className="flex items-start gap-3 py-2.5">
                    <Phone size={16} className="mt-0.5 shrink-0 text-brand-600 dark:text-sky-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-800 dark:text-slate-100">{call.note}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500">{call.at} · {call.loggedBy}</div>
                    </div>
                    {call.forwarded && <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">Forwarded to office</span>}
                  </div>
                ))}
                {texts.map((tx) => (
                  <div key={tx.leadKey} className="flex items-start gap-3 py-2.5">
                    <MessageSquare size={16} className="mt-0.5 shrink-0 text-brand-600 dark:text-sky-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-800 dark:text-slate-100">{TEXT_KIND_LABEL[tx.kind] ?? tx.kind}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500">
                        {tx.sentAt ? tx.sentAt.toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                        {tx.channel ? ` · ${tx.channel}` : ''} · delivered
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* AI draft reply to HD (renders its own card) */}
          {aiConfigured() && <HdReplyDrafter caseId={c.id} />}

          {/* Case files & links */}
          <Section icon={Paperclip} title="Case files & links">
            <CaseAttachments caseId={c.id} attachments={c.attachments} />
          </Section>

          {/* Activity */}
          <Section icon={Clock} title="Activity">
            {c.notes.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-gray-100 pl-5 dark:border-slate-700">
                {c.notes.map((n) => (
                  <li key={n.id} className="relative">
                    <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 ${n.statusTo ? 'border-brand-600 bg-brand-600' : 'border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800'}`} />
                    <div className="text-xs text-gray-400 dark:text-slate-500">{n.at} · {n.author}</div>
                    <div className="text-sm text-gray-800 dark:text-slate-100">
                      {n.statusTo ? <span className="font-semibold text-brand-700 dark:text-sky-300">→ {STATUS_LABEL[n.statusTo]}</span> : n.body}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </main>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          {/* Status & SLA */}
          <Section icon={ShieldCheck} title="Status">
            <div className="space-y-3.5">
              <span className={statusChipClass(c.status)}>{STATUS_LABEL[c.status]}</span>

              {c.awaitingReplyDays != null && (
                <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${c.awaitingReplyDays >= 5 ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'}`}>
                  <Clock size={20} className={c.awaitingReplyDays >= 5 ? 'text-red-600' : 'text-amber-600'} />
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Awaiting your reply</div>
                    <div className={`text-sm font-semibold ${c.awaitingReplyDays >= 5 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {c.awaitingReplyDays} day{c.awaitingReplyDays === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              )}
              {c.age === 'red' && <div className="text-xs font-semibold text-red-600">● Aging (&gt;7 days)</div>}
              {c.age === 'amber' && <div className="text-xs font-semibold text-amber-600">● Ageing (&gt;3 days)</div>}

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-gray-400 dark:text-slate-500">Assigned</dt><dd className="text-right text-gray-900 dark:text-slate-100">{c.assignedTo ?? 'Unassigned'}</dd>
                <dt className="text-gray-400 dark:text-slate-500">Office</dt><dd className="text-right text-gray-900 dark:text-slate-100">{c.officeName}</dd>
                {c.priority === 'high' && (<><dt className="text-gray-400 dark:text-slate-500">Priority</dt><dd className="text-right font-semibold text-red-700 dark:text-red-400">High</dd></>)}
              </dl>
            </div>
          </Section>

          {/* Actions: status, assign, notify office, add note (renders its own card) */}
          <CaseControls
            caseId={c.id}
            status={c.status}
            assignedToId={c.assignedToId}
            staff={staff}
            canNotifyOffice={!!c.applicationId}
            officeName={c.officeName}
          />
        </aside>
      </div>
    </div>
  );
}
