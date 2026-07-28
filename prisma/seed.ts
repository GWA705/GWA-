import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptOptional } from '../src/lib/crypto';
import { CONSENT_POLICY_VERSION, CONSENT_TEXT } from '../src/lib/constants';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@gwa.example').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!Admin123';

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'GWA Administrator',
      role: 'ADMIN',
      passwordHash: await hash(adminPassword),
    },
  });
  console.log(`Admin: ${admin.email}`);

  // Reviewer
  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@gwa.example' },
    update: {},
    create: {
      email: 'reviewer@gwa.example',
      name: 'Jordan Reviewer',
      role: 'REVIEWER',
      passwordHash: await hash('ChangeMe!Review123'),
    },
  });
  console.log(`Reviewer: ${reviewer.email}`);

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

  const dealerUser = await prisma.user.upsert({
    where: { email: 'dealer@barrie.example' },
    update: {},
    create: {
      email: 'dealer@barrie.example',
      name: 'Sam Dealer',
      role: 'DEALER_USER',
      dealerId: dealer.id,
      passwordHash: await hash('ChangeMe!Dealer123'),
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
    },
  });
  console.log(`Dealers: ${dealer.name}, ${dealer2.name}`);

  // Home Depot stores assigned to each dealer
  const storeSeed = [
    { id: 'seed-store-1', dealerId: dealer.id, number: '7112', name: 'Barrie' },
    { id: 'seed-store-2', dealerId: dealer.id, number: '7124', name: 'Barrie South' },
    { id: 'seed-store-3', dealerId: dealer2.id, number: '7091', name: 'North Bay' },
  ];
  for (const s of storeSeed) {
    await prisma.homeDepotStore.upsert({ where: { id: s.id }, update: {}, create: s });
  }

  // Sample application (only if none exist for this dealer)
  const existing = await prisma.application.count({ where: { dealerId: dealer.id } });
  if (existing === 0) {
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
        incomeAnnual: 72000,
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

  console.log('\nSeed complete. Sample logins (change in production):');
  console.log(`  Admin:    ${adminEmail} / ${adminPassword}`);
  console.log('  Reviewer: reviewer@gwa.example / ChangeMe!Review123');
  console.log('  Dealer:   dealer@barrie.example / ChangeMe!Dealer123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
