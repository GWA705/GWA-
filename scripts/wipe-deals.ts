/**
 * One-time maintenance — WIPE ALL DEALS (start-fresh for go-live).
 *
 * Deletes every deal (Application) and everything attached to it — documents,
 * notes, decisions, status history, confirmations, verification checks, payouts,
 * serial numbers, reminders, payment splits, loan-application details, consents —
 * plus the uploaded files in storage and the audit-log entries tied to those
 * deals.
 *
 * It does NOT touch: dealers, users, marketplace items, content/resources,
 * finance companies, products, mail, pop-ups, reminder settings, or any app
 * setting. So you can wipe the test deals and start collecting real data without
 * losing the rest of the portal.
 *
 * SAFE BY DEFAULT — a dry run that only prints what WOULD be deleted. Nothing is
 * removed unless you pass --yes (or set WIPE_DEALS_CONFIRM=YES):
 *
 *     npx tsx scripts/wipe-deals.ts          # dry run (counts only)
 *     npx tsx scripts/wipe-deals.ts --yes    # actually delete
 *
 * Runs against whatever DATABASE_URL is set — make sure it points at the live
 * database when you mean to wipe production.
 */
import { prisma } from '../src/lib/db';
import { deleteDocument } from '../src/lib/storage';

async function main() {
  const confirmed = process.argv.includes('--yes') || process.env.WIPE_DEALS_CONFIRM === 'YES';

  const apps = await prisma.application.findMany({ select: { id: true } });
  const appIds = apps.map((a) => a.id);
  const docs = await prisma.document.findMany({ select: { id: true, storageKey: true } });
  const docIds = docs.map((d) => d.id);

  const auditWhere = {
    OR: [
      { entityType: 'Application', entityId: { in: appIds } },
      { entityType: 'Document', entityId: { in: docIds } },
    ],
  };

  const [notes, decisions, statusEvents, payouts, confirmations, verifications, serials, reminders, splits, loanApps, consents, auditCount] =
    await Promise.all([
      prisma.note.count({ where: { applicationId: { in: appIds } } }),
      prisma.decision.count({ where: { applicationId: { in: appIds } } }),
      prisma.statusEvent.count({ where: { applicationId: { in: appIds } } }),
      prisma.payout.count({ where: { applicationId: { in: appIds } } }),
      prisma.confirmation.count({ where: { applicationId: { in: appIds } } }),
      prisma.verificationCheck.count({ where: { applicationId: { in: appIds } } }),
      prisma.serialNumber.count({ where: { applicationId: { in: appIds } } }),
      prisma.dealerReminder.count({ where: { applicationId: { in: appIds } } }),
      prisma.paymentSplit.count({ where: { applicationId: { in: appIds } } }),
      prisma.loanApplication.count({ where: { applicationId: { in: appIds } } }),
      prisma.consent.count({ where: { applicationId: { in: appIds } } }),
      prisma.auditLog.count({ where: auditWhere }),
    ]);

  console.log('--- Deal wipe plan ---');
  console.log(`Deals (applications):        ${appIds.length}`);
  console.log(`Uploaded files to remove:    ${docs.length}`);
  console.log(`Notes ${notes} · Decisions ${decisions} · Status events ${statusEvents} · Payouts ${payouts}`);
  console.log(`Confirmations ${confirmations} · Verification checks ${verifications} · Serial numbers ${serials}`);
  console.log(`Reminders ${reminders} · Payment splits ${splits} · Loan applications ${loanApps} · Consents ${consents}`);
  console.log(`Audit-log entries to remove: ${auditCount}`);
  console.log('Untouched: dealers, users, marketplace, content, finance companies, products, mail, settings.');

  if (appIds.length === 0) {
    console.log('\nNo deals in the database — nothing to do.');
    return;
  }

  if (!confirmed) {
    console.log('\nDRY RUN — nothing was deleted. Re-run with --yes to actually delete.');
    return;
  }

  console.log('\nDeleting…');

  // 1) Delete the file blobs from storage (best-effort; a failure just leaves an
  //    orphaned blob, which is harmless).
  let filesDeleted = 0;
  let fileErrors = 0;
  for (const d of docs) {
    try {
      await deleteDocument(d.storageKey);
      filesDeleted += 1;
    } catch (e) {
      fileErrors += 1;
      console.error(`  file delete failed (${d.storageKey}): ${(e as Error).message}`);
    }
  }
  console.log(`Files removed: ${filesDeleted}${fileErrors ? ` (${fileErrors} failed — orphaned blobs, safe to ignore)` : ''}`);

  // 2) Audit-log + webhook rows referencing these deals (string references, not
  //    FKs, so they don't cascade).
  const auditDel = await prisma.auditLog.deleteMany({ where: auditWhere });
  console.log(`Audit entries removed: ${auditDel.count}`);
  const webhookDel = await prisma.webhookEvent.deleteMany({ where: { applicationId: { in: appIds } } });
  console.log(`Webhook events removed: ${webhookDel.count}`);

  // 3) Delete the deal children explicitly (in a transaction), then the deals.
  //    Explicit deletes don't rely on the FK cascade config being present.
  const where = { applicationId: { in: appIds } };
  await prisma.$transaction([
    prisma.paymentSplit.deleteMany({ where }),
    prisma.verificationCheck.deleteMany({ where }),
    prisma.confirmation.deleteMany({ where }),
    prisma.dealerReminder.deleteMany({ where }),
    prisma.serialNumber.deleteMany({ where }),
    prisma.payout.deleteMany({ where }),
    prisma.decision.deleteMany({ where }),
    prisma.statusEvent.deleteMany({ where }),
    prisma.consent.deleteMany({ where }),
    prisma.note.deleteMany({ where }),
    prisma.loanApplication.deleteMany({ where }),
    prisma.document.deleteMany({ where }),
    prisma.application.deleteMany({ where: { id: { in: appIds } } }),
  ]);

  console.log(`Deals removed: ${appIds.length}`);
  console.log('\nDone — the portal is clean of deals; everything else is intact.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
