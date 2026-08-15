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
  updatedByName: string | null;
  updatedAt: Date;
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
      { phone: r.phone, address: r.address, email: r.email, updatedByName: r.updatedByName, updatedAt: r.updatedAt },
    ]),
  );
}

/** Fetch a single override (or null). */
export async function getOverride(key: string): Promise<ContactOverride | null> {
  const r = await prisma.customerContactOverride.findUnique({ where: { key } });
  if (!r) return null;
  return { phone: r.phone, address: r.address, email: r.email, updatedByName: r.updatedByName, updatedAt: r.updatedAt };
}

/** Overlay an override field on top of an original value (override wins when set). */
export function overlay(original: string, ov: string | null | undefined): string {
  return ov != null && ov !== '' ? ov : original;
}
