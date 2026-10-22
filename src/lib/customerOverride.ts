import 'server-only';
import { prisma } from './db';

/**
 * Customer contact overrides. Corrections to a customer's phone / address /
 * email are stored here, never written back onto the original journal row or
 * portal application — the original stays as the source record and the override
 * is overlaid when we show the customer, with a "last updated" stamp.
 */

export interface ContactOverride {
  phone: string | null;
  address: string | null;
  email: string | null;
  customerName: string | null; // the customer this correction was saved for
  updatedByName: string | null;
  updatedAt: Date;
}

function normName(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Whether a journal-ROW override still applies to the row it's keyed to. A row
 * override is positional (`row:<year>|<tab>|<row>`), and journal rows shift when
 * the sheet is edited or re-imported — so the same position can later hold a
 * DIFFERENT customer. We only overlay a row override when its saved customer name
 * still matches the row, so one customer's correction can never bleed onto another.
 * (Portal `app:` overrides are keyed by a stable id and don't need this check.)
 */
export function rowOverrideApplies(ov: Pick<ContactOverride, 'customerName'>, currentName: string): boolean {
  const saved = normName(ov.customerName);
  return saved !== '' && saved === normName(currentName);
}

/** Override key for a portal deal. */
export function appOverrideKey(applicationId: string): string {
  return `app:${applicationId}`;
}

/** Override key for a journal-only row. */
export function rowOverrideKey(year: number, tab: string, row: number): string {
  return `row:${year}|${tab}|${row}`;
}

/** Fetch overrides for a set of keys, as a map. */
export async function getOverrides(keys: string[]): Promise<Map<string, ContactOverride>> {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = await prisma.customerContactOverride.findMany({ where: { key: { in: unique } } });
  return new Map(
    rows.map((r) => [
      r.key,
      { phone: r.phone, address: r.address, email: r.email, customerName: r.customerName, updatedByName: r.updatedByName, updatedAt: r.updatedAt },
    ]),
  );
}

/** Fetch a single override (or null). */
export async function getOverride(key: string): Promise<ContactOverride | null> {
  const r = await prisma.customerContactOverride.findUnique({ where: { key } });
  if (!r) return null;
  return { phone: r.phone, address: r.address, email: r.email, customerName: r.customerName, updatedByName: r.updatedByName, updatedAt: r.updatedAt };
}

/** Overlay an override field on top of an original value (override wins when set). */
export function overlay(original: string, ov: string | null | undefined): string {
  return ov != null && ov !== '' ? ov : original;
}
