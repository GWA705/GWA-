import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import {
  createIdTagRequest, setIdTagStatus, setIdTagCardInfo, saveIdTagHeadshot,
  getIdTagDetail, getIdTagFileKeys, listIdTagForDealer, listAllIdTags,
  idTagFileName, suggestIdTagPassword, daysUntil, expiryTone, expiryLabel,
  setDealerEntuitiveProfile, setDealerIdTagPassword, deleteIdTag,
} from '@/lib/idTag';
import { provinceTax, monthlyActivations, ID_TAG_UNIT_PRICE_CENTS } from '@/lib/idTagBilling';
import { putDocument, getDocument } from '@/lib/storage';

// Real end-to-end against a database. Skipped unless DATABASE_URL is set, so
// `npm test` stays DB-free; run it with an ephemeral Postgres + STORAGE_DRIVER=local.
const RUN = !!process.env.DATABASE_URL;

describe.skipIf(!RUN)('HD ID-tag flow — end to end', () => {
  let dealerId: string;
  let userId: string;
  let tagId: string;

  beforeAll(async () => {
    const dealer = await prisma.dealer.create({ data: { name: 'Georgian Water and Air - Barrie' } });
    dealerId = dealer.id;
    await setDealerIdTagPassword(dealerId, 'Barrie123!');
    await setDealerEntuitiveProfile(dealerId, {
      companyName: 'Georgian Water and Air - Barrie', street: '11', streetName: 'King St', unit: '10',
      city: 'Barrie', province: 'Ontario', postal: 'L4M 6B5', phone: '7058120320',
      service: 'Water Treatment (Home Depot Canada)',
    });
    const user = await prisma.user.create({ data: { email: 'submitter@example.com', name: 'Office Admin', passwordHash: 'x', role: 'DEALER_USER', dealerId } });
    userId = user.id;
    await prisma.trainingCertification.create({ data: {
      dealerId, traineeName: 'Test Rep', traineeEmail: 'test.rep@example.com', traineePhone: '7055551234',
      startDate: '2026-10-20', answers: {}, score: 100, passed: true, acknowledged: [], signatureName: 'Test Rep', contentVersion: 'v1',
    } });
  });

  afterAll(async () => {
    await prisma.homeDepotIdTag.deleteMany({ where: { dealerId } }).catch(() => {});
    await prisma.trainingCertification.deleteMany({ where: { dealerId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { dealerId } }).catch(() => {});
    await prisma.dealer.delete({ where: { id: dealerId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('pure helpers (password suggestion, tax, filename, expiry)', () => {
    expect(suggestIdTagPassword('Georgian Water and Air, Winnipeg')).toBe('Winnipeg123!');
    expect(suggestIdTagPassword('CAWS')).toBe('CAWS123!');
    expect(provinceTax('Ontario').rate).toBeCloseTo(0.13);
    expect(provinceTax('BC').rate).toBeCloseTo(0.12);
    expect(provinceTax('Alberta').rate).toBeCloseTo(0.05);
    expect(idTagFileName({ personName: 'Warren Ryckman', date: '2026-10-23', badgeNumber: '1043317' }, 'card', 'pdf'))
      .toBe('Warren-Ryckman_2026-10-23_HD1043317_card.pdf');
    expect(daysUntil(null)).toBeNull();
    expect(expiryTone(40)).toBe('green');
    expect(expiryTone(20)).toBe('amber');
    expect(expiryTone(-1)).toBe('red');
    expect(expiryLabel(5)).toBe('5 days left');
  });

  it('1) dealer submits a certified new rep → SUBMITTED + screening email flagged', async () => {
    const res = await createIdTagRequest({
      dealerId, submittedById: userId, personName: 'Test Rep', personFirst: 'Test', personLast: 'Rep',
      personEmail: 'test.rep@example.com', personPhone: '7055551234', kind: 'NEW',
    });
    tagId = res.id;
    expect(res.certified).toBe(true);
    expect(res.status).toBe('SUBMITTED');
    expect(res.sendScreeningEmail).toBe(true);
  });

  it('2) reviewer moves it through screening → activation stamps activatedAt once', async () => {
    await setIdTagStatus(tagId, 'BACKGROUND_CHECK');
    await setIdTagStatus(tagId, 'APPROVED');
    const before = await prisma.homeDepotIdTag.findUnique({ where: { id: tagId }, select: { activatedAt: true } });
    expect(before?.activatedAt).toBeNull();
    await setIdTagStatus(tagId, 'TAG_ISSUED');
    const after = await prisma.homeDepotIdTag.findUnique({ where: { id: tagId }, select: { activatedAt: true, status: true } });
    expect(after?.status).toBe('TAG_ISSUED');
    expect(after?.activatedAt).toBeInstanceOf(Date);
  });

  it('3) headshot + card upload round-trip through storage', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000', 'hex');
    const ok = await saveIdTagHeadshot(tagId, new File([png], 'headshot.png', { type: 'image/png' }));
    expect(ok).toBe(true);
    const keys = await getIdTagFileKeys(tagId);
    expect(keys?.headshotKey).toBeTruthy();
    expect(Buffer.compare(await getDocument(keys!.headshotKey!), png)).toBe(0);

    const cardKey = `idtags/${dealerId}/${Date.now()}-card.png`;
    await putDocument(cardKey, png);
    await setIdTagCardInfo(tagId, { validUntil: new Date('2027-10-20T00:00:00'), badgeNumber: '1043317', entuitiveStatus: 'Approved / Approuvé', cardFileKey: cardKey });

    const d = await getIdTagDetail(tagId);
    expect(d?.hasHeadshot).toBe(true);
    expect(d?.hasCard).toBe(true);
    expect(d?.cardIsImage).toBe(true);
    expect(d?.badgeNumber).toBe('1043317');
    expect(d?.validUntil).toBeInstanceOf(Date);
  });

  it('4) setup sheet auto-fills from the office profile + person', async () => {
    const d = await getIdTagDetail(tagId);
    expect(d?.personFirst).toBe('Test');
    expect(d?.personLast).toBe('Rep');
    expect(d?.password).toBe('Barrie123!');
    expect(d?.profile.companyName).toContain('Barrie');
    expect(d?.profile.province).toBe('Ontario');
    expect(d?.profile.service).toContain('Water Treatment');
  });

  it('5) auto-named download uses the training start date', async () => {
    const keys = await getIdTagFileKeys(tagId);
    expect(keys?.startedDate).toBe('2026-10-20');
    expect(idTagFileName({ personName: 'Test Rep', date: keys!.startedDate, badgeNumber: keys!.badgeNumber }, 'card', 'png'))
      .toBe('Test-Rep_2026-10-20_HD1043317_card.png');
  });

  it('6) dealer + reviewer lists reflect the card, and search finds the rep', async () => {
    const row = (await listIdTagForDealer(dealerId)).find((r) => r.id === tagId)!;
    expect(row.hasCard).toBe(true);
    expect(row.cardIsImage).toBe(true);
    expect(row.hasHeadshot).toBe(true);
    expect((await listAllIdTags({ q: 'Test Rep' })).some((r) => r.id === tagId)).toBe(true);
    expect((await listAllIdTags({ q: '1043317' })).some((r) => r.id === tagId)).toBe(true);
  });

  it('7) billing: $35 + Ontario 13% for the activation month, attributed to the submitter', async () => {
    const tag = await prisma.homeDepotIdTag.findUnique({ where: { id: tagId }, select: { activatedAt: true } });
    const d = tag!.activatedAt!;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const office = (await monthlyActivations(month)).offices.find((o) => o.dealerId === dealerId)!;
    expect(office.count).toBe(1);
    expect(office.subtotalCents).toBe(ID_TAG_UNIT_PRICE_CENTS); // 3500 = $35.00
    expect(office.taxCode).toBe('ON');
    expect(office.taxCents).toBe(455); // 13%
    expect(office.totalCents).toBe(3955);
    expect(office.people[0].name).toBe('Test Rep');
    expect(office.people[0].createdBy).toBe('Office Admin');
  });

  it('8) delete removes the record and its stored files', async () => {
    const keys = await getIdTagFileKeys(tagId);
    const hk = keys!.headshotKey!;
    await deleteIdTag(tagId);
    expect(await prisma.homeDepotIdTag.findUnique({ where: { id: tagId } })).toBeNull();
    await expect(getDocument(hk)).rejects.toBeTruthy();
  });
});
