import 'server-only';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from './db';
import { decryptOptional } from './crypto';
import { journalProductNames } from './products';
import {
  pushSoldCustomerToBooking,
  pushCancelledSaleToBooking,
  pushSoldCustomersToBooking,
  type BookingSoldCustomer,
} from './bookingPush';

/**
 * Portal → booking: a funded deal becomes a CUSTOMER in the booking system (the
 * post-sale household record), so the customer's info and equipment show up on
 * their booking profile / household — never on a booker's calling screen. A
 * cancelled (withdrawn) deal reverses that sale.
 *
 * The transport + fail-safe behaviour live in bookingPush.ts; this module owns
 * the mapping from an Application to the booking payload (decrypting the address,
 * resolving product names to their journal codes) and the single entry point the
 * status-change hooks call.
 */

/** An Application reduced to what the booking payload needs (address already decrypted). */
export interface SoldAppRecord {
  id: string;
  applicantFirstName: string | null;
  applicantLastName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  applicantCity: string | null;
  applicantPostal: string | null;
  province: string | null;
  address: string | null;
  coApplicantName: string | null;
  productsSold: string[];
}

/**
 * Pure mapping from a fetched Application to the booking sold-customer payload.
 * `productCodes` is the journal code per `productsSold` entry (same order), and
 * `soldAt` is the date the deal funded. No I/O — unit-tested directly.
 *
 * The co-applicant on a credit deal is the household co-owner, so it maps to the
 * booking customer's spouse/co-owner name. There is no co-applicant phone on a
 * funded deal, so spousePhone is left unset.
 */
export function buildSoldPayloadFrom(
  app: SoldAppRecord,
  productCodes: string[],
  soldAt: Date | null,
): BookingSoldCustomer {
  const name = `${app.applicantFirstName ?? ''} ${app.applicantLastName ?? ''}`.trim();
  const products = (app.productsSold ?? []).map((nm, i) => ({
    sku: productCodes[i] ?? null,
    name: nm,
  }));
  return {
    applicationId: app.id,
    name: name || null,
    phone: app.applicantPhone ?? null,
    email: app.applicantEmail ?? null,
    address: app.address ?? null,
    city: app.applicantCity ?? null,
    province: app.province ?? null,
    postalCode: app.applicantPostal ?? null,
    spouseName: app.coApplicantName ?? null,
    soldAt: soldAt ? soldAt.toISOString() : null,
    products,
  };
}

const SOLD_APP_SELECT = {
  id: true,
  applicantFirstName: true,
  applicantLastName: true,
  applicantEmail: true,
  applicantPhone: true,
  applicantCity: true,
  applicantPostal: true,
  province: true,
  applicantAddressEnc: true,
  coApplicantName: true,
  productsSold: true,
  dealerId: true,
} as const;

type SoldAppRow = {
  id: string;
  applicantFirstName: string;
  applicantLastName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantCity: string | null;
  applicantPostal: string | null;
  province: string | null;
  applicantAddressEnc: string | null;
  coApplicantName: string | null;
  productsSold: string[];
  dealerId: string | null;
};

/** The date a deal funded = the most recent status event into FUNDED. */
async function fundedAt(applicationId: string): Promise<Date | null> {
  const ev = await prisma.statusEvent.findFirst({
    where: { applicationId, to: 'FUNDED' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return ev?.createdAt ?? null;
}

/** Turn one Application row into a booking payload (decrypt address, map codes). */
async function toSoldPayload(row: SoldAppRow, soldAt: Date | null): Promise<BookingSoldCustomer> {
  const codes = row.productsSold.length ? await journalProductNames(row.productsSold, row.dealerId) : [];
  return buildSoldPayloadFrom(
    {
      id: row.id,
      applicantFirstName: row.applicantFirstName,
      applicantLastName: row.applicantLastName,
      applicantEmail: row.applicantEmail,
      applicantPhone: row.applicantPhone,
      applicantCity: row.applicantCity,
      applicantPostal: row.applicantPostal,
      province: row.province,
      address: decryptOptional(row.applicantAddressEnc),
      coApplicantName: row.coApplicantName,
      productsSold: row.productsSold,
    },
    codes,
    soldAt,
  );
}

/** Build the booking payload for one application, or null if it's gone. */
export async function buildSoldPayload(applicationId: string): Promise<BookingSoldCustomer | null> {
  const row = (await prisma.application.findUnique({
    where: { id: applicationId },
    select: SOLD_APP_SELECT,
  })) as SoldAppRow | null;
  if (!row) return null;
  return toSoldPayload(row, await fundedAt(applicationId));
}

/**
 * The single hook the status-change paths call. FUNDED pushes the sold customer;
 * WITHDRAWN reverses the sale. Everything else is a no-op. Fully fail-safe — a
 * booking outage or mapping error never affects the portal action that triggered
 * it.
 */
export async function syncApplicationSoldStateToBooking(
  applicationId: string,
  status: ApplicationStatus,
): Promise<void> {
  try {
    if (status === 'FUNDED') {
      const payload = await buildSoldPayload(applicationId);
      if (payload) await pushSoldCustomerToBooking(payload);
    } else if (status === 'WITHDRAWN') {
      await pushCancelledSaleToBooking(applicationId);
    }
  } catch (e) {
    console.error('[bookingSold] sync failed', e);
  }
}

/** What one sold-customer backfill run did (same shape as the lead backfill). */
export interface SoldBackfillResult {
  configured: boolean;
  sent: number;
  created: number;
  merged: number; // already there / reversed — the retry-safe no-op
  skipped: number;
  failed: number;
  /** Cursor for the next page, null when the sweep is done. */
  nextId: string | null;
  done: boolean;
}

const BACKFILL_CHUNK = 100;

/**
 * One page of the historical backfill: send up to BACKFILL_CHUNK funded deals
 * (oldest first, after `afterId`) to booking as sold customers. Safe to re-run —
 * booking dedupes by phone and by the portal deal id. Returns a cursor so an
 * admin button can page through the whole book without one giant request.
 */
export async function backfillSoldCustomersPage(afterId: string | null): Promise<SoldBackfillResult> {
  const rows = (await prisma.application.findMany({
    where: { status: 'FUNDED', ...(afterId ? { id: { gt: afterId } } : {}) },
    orderBy: { id: 'asc' },
    take: BACKFILL_CHUNK,
    select: SOLD_APP_SELECT,
  })) as SoldAppRow[];

  if (rows.length === 0) {
    return { configured: true, sent: 0, created: 0, merged: 0, skipped: 0, failed: 0, nextId: null, done: true };
  }

  const ids = rows.map((r) => r.id);
  const events = await prisma.statusEvent.findMany({
    where: { applicationId: { in: ids }, to: 'FUNDED' },
    orderBy: { createdAt: 'desc' },
    select: { applicationId: true, createdAt: true },
  });
  const fundedWhen = new Map<string, Date>();
  for (const e of events) if (!fundedWhen.has(e.applicationId)) fundedWhen.set(e.applicationId, e.createdAt);

  const payloads = await Promise.all(rows.map((r) => toSoldPayload(r, fundedWhen.get(r.id) ?? null)));
  const res = await pushSoldCustomersToBooking(payloads);

  const done = rows.length < BACKFILL_CHUNK;
  return {
    configured: res.configured,
    sent: res.sent,
    created: res.created,
    merged: res.duplicate,
    skipped: res.skipped,
    failed: res.failed,
    nextId: done ? null : ids[ids.length - 1],
    done,
  };
}
