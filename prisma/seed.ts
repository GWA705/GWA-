import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { encryptOptional } from '../src/lib/crypto';
import { CONSENT_POLICY_VERSION, CONSENT_TEXT } from '../src/lib/constants';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

// A strong random bootstrap password (used only when SEED_ADMIN_PASSWORD is not
// set) so we never ship a known default admin credential.
function randomPassword() {
  return crypto.randomBytes(15).toString('base64').replace(/[^A-Za-z0-9]/g, '') + 'Aa1!';
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const generatedAdminPassword = !process.env.SEED_ADMIN_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || randomPassword();

  // Demo accounts (reviewer/dealer with fake @…example emails) are only created
  // when SEED_DEMO=true. In production they're left out, so they can't receive
  // — and bounce — notification emails. Real accounts are made in the admin UI.
  const seedDemo = process.env.SEED_DEMO === 'true';

  // Bootstrap admin — only when there is no admin yet, so a fresh environment
  // has a way in. Once you've created your own admin and removed this one, it
  // won't come back.
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount === 0) {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'GWA Administrator',
        role: 'ADMIN',
        // The bootstrap admin is a Super Admin so a fresh environment always has
        // full back-end access and someone who can grant access to others.
        superAdmin: true,
        passwordHash: await hash(adminPassword),
        // null → treated as "must change" so the bootstrap password is forced to
        // be changed at first login.
        passwordChangedAt: null,
      },
    });
    console.log(`Bootstrap admin created: ${admin.email}`);
    if (generatedAdminPassword) {
      console.log(
        `  Temporary admin password (set once — change at first login): ${adminPassword}`,
      );
    }
  }

  // Reviewer (demo only)
  if (seedDemo) {
    const reviewer = await prisma.user.upsert({
      where: { email: 'reviewer@gwa.example' },
      update: {},
      create: {
        email: 'reviewer@gwa.example',
        name: 'Jordan Reviewer',
        role: 'REVIEWER',
        passwordHash: await hash('ChangeMe!Review123'),
        passwordChangedAt: new Date(),
      },
    });
    console.log(`Reviewer: ${reviewer.email}`);
  }

  // Dealer + dealer users
  const dealer = await prisma.dealer.upsert({
    where: { id: 'seed-dealer-1' },
    update: {},
    create: { id: 'seed-dealer-1', name: 'Barrie Home Comfort' },
  });
  const dealer2 = await prisma.dealer.upsert({
    where: { id: 'seed-dealer-2' },
    update: {},
    create: { id: 'seed-dealer-2', name: 'North Bay Mechanical' },
  });

  // Demo dealer users (fake emails) — demo only.
  let dealerUser: { id: string } | null = null;
  if (seedDemo) {
    dealerUser = await prisma.user.upsert({
      where: { email: 'dealer@barrie.example' },
      update: {},
      create: {
        email: 'dealer@barrie.example',
        name: 'Sam Dealer',
        role: 'DEALER_USER',
        dealerId: dealer.id,
        passwordHash: await hash('ChangeMe!Dealer123'),
        passwordChangedAt: new Date(),
      },
    });
    await prisma.user.upsert({
      where: { email: 'dealer@northbay.example' },
      update: {},
      create: {
        email: 'dealer@northbay.example',
        name: 'Alex Dealer',
        role: 'DEALER_USER',
        dealerId: dealer2.id,
        passwordHash: await hash('ChangeMe!Dealer123'),
        passwordChangedAt: new Date(),
      },
    });
  }
  console.log(`Dealers: ${dealer.name}, ${dealer2.name}`);

  // Finance companies — demo placeholders only. In production the real list is
  // managed in Admin → Finance cos, so we must NOT re-create these on every
  // deploy (that would resurrect ones an admin deleted). Gated behind SEED_DEMO.
  if (seedDemo) {
    for (const [id, name] of [
      ['seed-fc-1', 'FinanceIT'],
      ['seed-fc-2', 'FinanceIT Home'],
      ['seed-fc-3', 'SNAP Financial'],
    ] as const) {
      await prisma.financeCompany.upsert({ where: { id }, update: {}, create: { id, name } });
    }
  }

  // Home Depot stores assigned to each dealer
  const storeSeed = [
    { id: 'seed-store-1', dealerId: dealer.id, number: '7112', name: 'Barrie' },
    { id: 'seed-store-2', dealerId: dealer.id, number: '7124', name: 'Barrie South' },
    { id: 'seed-store-3', dealerId: dealer2.id, number: '7091', name: 'North Bay' },
  ];
  for (const s of storeSeed) {
    await prisma.homeDepotStore.upsert({ where: { id: s.id }, update: {}, create: s });
  }

  // Product catalog for the sales-journal dropdown. Seed the journal's default
  // list ONLY when the table is empty, so admin edits/deletes aren't undone on
  // redeploy.
  if ((await prisma.product.count()) === 0) {
    const defaultProducts = [
      'WS', 'City', 'Country', 'UV12', 'UV20', 'SIM', 'HEPA', 'RPS UV',
      'SOAP', 'WHCCF', 'BEYOND', 'ANGEL', 'Guardian Home Air', 'Elevate PH+',
    ];
    await prisma.product.createMany({
      data: defaultProducts.map((name, i) => ({ name, sortOrder: i })),
    });
    console.log(`Seeded ${defaultProducts.length} products.`);
  }

  // Default quick-note templates for reviewers (only if none exist yet).
  if ((await prisma.noteTemplate.count()) === 0) {
    const defaultTemplates = [
      { label: 'Missing void cheque', body: 'We still need a void cheque or PAP form to fund this deal. Please upload it under the funding package.' },
      { label: 'Photo missing serial', body: 'The installation photo doesn’t clearly show the serial number. Please upload a photo where the serial number is visible.' },
      { label: 'Signatures missing', body: 'One or more required signatures are missing on the finance/Home Depot documents. Please have them signed and re-upload.' },
      { label: 'Docs unclear', body: 'The uploaded document is blurry or cut off. Please re-upload a clear, complete copy.' },
      { label: 'Approved — send funding', body: 'This deal is approved. Please submit the funding package (signed contract, void cheque/PAP, install photos, signed HD documents, and ID) when ready.' },
    ];
    await prisma.noteTemplate.createMany({
      data: defaultTemplates.map((t, i) => ({ ...t, sortOrder: i })),
    });
    console.log(`Seeded ${defaultTemplates.length} note templates.`);
  }

  // Sample application (demo only, and only if none exist for this dealer)
  const existing = await prisma.application.count({ where: { dealerId: dealer.id } });
  if (seedDemo && dealerUser && existing === 0) {
    await prisma.application.create({
      data: {
        dealerId: dealer.id,
        createdById: dealerUser.id,
        status: 'SUBMITTED',
        province: 'ON',
        programType: 'HD',
        programCategory: 'HVAC',
        requestedAmount: 8500,
        dateOfSale: new Date('2026-07-20'),
        installationDate: new Date('2026-07-27'),
        homeDepotStoreId: 'seed-store-1',
        financingNote: 'Customer requested the 12-month no-interest HD promo.',
        financeItNumber: '7123456',
        applicantFirstName: 'Pat',
        applicantLastName: 'Sample',
        applicantEmail: 'pat.sample@example.com',
        applicantPhone: '705-555-0142',
        applicantSinEnc: encryptOptional('123 456 789'),
        applicantDobEnc: encryptOptional('1985-04-12'),
        applicantAddressEnc: encryptOptional('12 Dunlop St, Barrie ON'),
        bankAccountEnc: encryptOptional('001-12345-6789012'),
        govIdNumberEnc: encryptOptional('D1234-56789-01234'),
        incomeAnnualEnc: encryptOptional('72000'),
        employer: 'Simcoe Logistics',
        homeownershipRequired: true,
        consents: {
          create: { policyVersion: CONSENT_POLICY_VERSION, consentText: CONSENT_TEXT },
        },
        statusEvents: { create: { to: 'SUBMITTED', actorId: dealerUser.id, note: 'Seed application' } },
      },
    });
    console.log('Created sample application.');
  }

  await backfillEncryption();

  console.log('\nSeed complete.');
  if (seedDemo) {
    console.log('Demo logins (change in production):');
    console.log(`  Admin:    ${adminEmail} / ${adminPassword}`);
    console.log('  Reviewer: reviewer@gwa.example / ChangeMe!Review123');
    console.log('  Dealer:   dealer@barrie.example / ChangeMe!Dealer123');
  }
}

/**
 * One-time (idempotent) backfill: move income + secondary/employer address
 * values from their legacy plaintext columns into the encrypted columns, then
 * null the plaintext. Safe to run on every deploy — it only touches rows that
 * still hold plaintext. The legacy columns are dropped in a later migration
 * once every environment has been backfilled.
 */
async function backfillEncryption() {
  // Application.incomeAnnual → incomeAnnualEnc
  const apps = await prisma.application.findMany({
    where: { incomeAnnual: { not: null } },
    select: { id: true, incomeAnnual: true, incomeAnnualEnc: true },
  });
  for (const a of apps) {
    await prisma.application.update({
      where: { id: a.id },
      data: {
        incomeAnnualEnc: a.incomeAnnualEnc ?? encryptOptional(String(a.incomeAnnual)),
        incomeAnnual: null,
      },
    });
  }

  // LoanApplication income + secondary/employer address street lines.
  const loans = await prisma.loanApplication.findMany({
    where: {
      OR: [
        { monthlyHousingCost: { not: null } },
        { grossMonthlyIncome: { not: null } },
        { coGrossMonthlyIncome: { not: null } },
        { mailingAddress: { not: null } },
        { previousAddress: { not: null } },
        { worksiteAddress: { not: null } },
        { employerAddress: { not: null } },
        { coEmployerAddress: { not: null } },
      ],
    },
  });
  for (const l of loans) {
    await prisma.loanApplication.update({
      where: { id: l.id },
      data: {
        monthlyHousingCostEnc: l.monthlyHousingCostEnc ?? encryptOptional(l.monthlyHousingCost != null ? String(l.monthlyHousingCost) : null),
        monthlyHousingCost: null,
        grossMonthlyIncomeEnc: l.grossMonthlyIncomeEnc ?? encryptOptional(l.grossMonthlyIncome != null ? String(l.grossMonthlyIncome) : null),
        grossMonthlyIncome: null,
        coGrossMonthlyIncomeEnc: l.coGrossMonthlyIncomeEnc ?? encryptOptional(l.coGrossMonthlyIncome != null ? String(l.coGrossMonthlyIncome) : null),
        coGrossMonthlyIncome: null,
        mailingAddressEnc: l.mailingAddressEnc ?? encryptOptional(l.mailingAddress),
        mailingAddress: null,
        previousAddressEnc: l.previousAddressEnc ?? encryptOptional(l.previousAddress),
        previousAddress: null,
        worksiteAddressEnc: l.worksiteAddressEnc ?? encryptOptional(l.worksiteAddress),
        worksiteAddress: null,
        employerAddressEnc: l.employerAddressEnc ?? encryptOptional(l.employerAddress),
        employerAddress: null,
        coEmployerAddressEnc: l.coEmployerAddressEnc ?? encryptOptional(l.coEmployerAddress),
        coEmployerAddress: null,
      },
    });
  }
  if (apps.length || loans.length) {
    console.log(`Backfilled encryption: ${apps.length} application(s), ${loans.length} loan record(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
