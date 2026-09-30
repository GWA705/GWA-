import 'server-only';
import { prisma } from './db';
import { placesConfigured, postalForAddress } from './googlePlaces';

/**
 * Fill in missing postal codes on scanned leads by geocoding their address with
 * Google, so leads scanned without a postal still route by area.
 *
 * Only a CONFIDENT (real street-level) match is written — a city-only or
 * OCR-mangled address is left blank rather than stamped with a wrong postal.
 *
 * Done in cursor-paged chunks so a backlog of thousands never runs long enough
 * to hit a request timeout: each call walks the next CHUNK of still-missing
 * leads (by id) and hands back a cursor for the next call.
 */

const CHUNK = 40; // leads looked at per call — one short request
const CONCURRENCY = 5; // parallel lookups within a chunk (gentle on Google)

export interface PostalFillChunk {
  /** False when GOOGLE_MAPS_API_KEY isn't set — nothing was attempted. */
  configured: boolean;
  processed: number; // leads looked at this call
  filled: number; // postals written (confident matches)
  blank: number; // no confident match — left blank on purpose
  failed: number; // lookup errored (transient) — safe to sweep again
  lastId: string | null; // cursor: pass back as afterId for the next call
  done: boolean; // no more leads missing a postal beyond the cursor
}

/** The string we hand Google: street, city, province, country. */
function addressQuery(address: string, city: string | null): string {
  const bits = [address.trim(), (city ?? '').trim(), 'ON'].filter(Boolean);
  return `${bits.join(', ')}, Canada`;
}

export async function fillMissingPostals(afterId?: string | null): Promise<PostalFillChunk> {
  const out: PostalFillChunk = {
    configured: placesConfigured(),
    processed: 0, filled: 0, blank: 0, failed: 0,
    lastId: afterId ?? null, done: true,
  };
  if (!out.configured) return out;

  const rows = await prisma.scannedLead.findMany({
    where: {
      address: { not: null },
      OR: [{ postalCode: null }, { postalCode: '' }],
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    select: { id: true, address: true, city: true },
    orderBy: { id: 'asc' },
    take: CHUNK,
  });

  if (rows.length === 0) return out; // done: true, nothing left

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (r) => {
        out.processed += 1;
        try {
          const { postal, confident } = await postalForAddress(addressQuery(r.address ?? '', r.city));
          if (confident && postal) {
            await prisma.scannedLead.update({ where: { id: r.id }, data: { postalCode: postal } });
            out.filled += 1;
          } else {
            out.blank += 1;
          }
        } catch (e) {
          console.error('[postalFill] lookup failed for', r.id, e);
          out.failed += 1;
        }
      }),
    );
  }

  out.lastId = rows[rows.length - 1].id;
  out.done = rows.length < CHUNK; // a short page means we reached the end
  return out;
}
