import 'server-only';
import { prisma } from './db';
import { readLeads, leadKeyOf, type Lead } from './leads';
import { sendPushToUser } from './push';

/**
 * New-lead push notifications. When a new HD lead lands in the "HD Leads Log"
 * sheet, the dealer whose office owns that store gets a push notification so they
 * can call the customer quickly.
 *
 * Attribution is by HD store number → the dealer that store belongs to — the
 * same mapping the leads list and reports use. Delivery is deduped through the
 * LeadNotified ledger (one row per lead key), so each lead is pushed exactly
 * once even though the sweep runs on a schedule and the sheet is a rolling log.
 *
 * First run: if the ledger is empty we silently record every existing lead as a
 * baseline and push nothing, so historical leads don't blast everyone at once.
 *
 * Only leads received within the last few days are ever pushed — this guards
 * against a bulk re-import of old rows (or a first baseline being lost) turning
 * into a flood of stale notifications. Genuinely new leads are always recent
 * because the sweep runs frequently.
 */

const NEW_LEAD_MAX_AGE_DAYS = 7;

// A short, low-sensitivity customer label for the push body: first name + last
// initial (e.g. "John D."), matching the convention used elsewhere. The dealer
// owns this customer relationship, but we still keep the full name out of the
// notification payload.
function shortName(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'a new customer';
  const first = parts[0];
  const lastInitial = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export interface SweepResult {
  configured: boolean;
  baselined?: number; // leads recorded silently on the first run
  pushed?: number; // leads pushed to at least one dealer user
  recorded?: number; // new lead keys added to the ledger this run
  error?: string;
}

export async function sweepNewLeads(): Promise<SweepResult> {
  const read = await readLeads(true);
  if (!read.configured) return { configured: false };
  if (read.error) return { configured: true, error: read.error };

  const leads = read.leads;
  const keyed = leads.map((l) => ({ lead: l, key: leadKeyOf(l) }));

  // First run: baseline every current lead so we don't push the whole backlog.
  const existingCount = await prisma.leadNotified.count();
  if (existingCount === 0) {
    if (keyed.length > 0) {
      await prisma.leadNotified.createMany({
        data: keyed.map((k) => ({ leadKey: k.key })),
        skipDuplicates: true,
      });
    }
    return { configured: true, baselined: keyed.length };
  }

  // Which of the current leads have we not handled yet?
  const currentKeys = keyed.map((k) => k.key);
  const known = new Set(
    (
      await prisma.leadNotified.findMany({
        where: { leadKey: { in: currentKeys } },
        select: { leadKey: true },
      })
    ).map((r) => r.leadKey),
  );
  const fresh = keyed.filter((k) => !known.has(k.key));
  if (fresh.length === 0) return { configured: true, pushed: 0, recorded: 0 };

  // Store number → dealerId (only stores that map to a dealer).
  const stores = await prisma.homeDepotStore.findMany({ select: { number: true, dealerId: true } });
  const storeToDealer = new Map<string, string>();
  for (const s of stores) {
    const num = s.number.trim();
    if (num) storeToDealer.set(num, s.dealerId);
  }

  // Dealer → its active users who want new-lead pushes (loaded lazily/cached).
  const dealerUsersCache = new Map<string, { id: string }[]>();
  async function usersFor(dealerId: string): Promise<{ id: string }[]> {
    const cached = dealerUsersCache.get(dealerId);
    if (cached) return cached;
    const users = await prisma.user.findMany({
      where: { dealerId, role: 'DEALER_USER', active: true, notifyNewLeads: true },
      select: { id: true },
    });
    dealerUsersCache.set(dealerId, users);
    return users;
  }

  const ageCut = Date.now() - NEW_LEAD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const toRecord: string[] = [];
  let pushed = 0;

  for (const { lead, key } of fresh) {
    // Always record a fresh lead key so we consider it exactly once, whether or
    // not it ends up pushable (old, unattributed, or no opted-in users).
    toRecord.push(key);

    const recent = lead.dateReceived ? lead.dateReceived.getTime() >= ageCut : false;
    if (!recent) continue;

    const dealerId = lead.storeNumber ? storeToDealer.get(lead.storeNumber.trim()) : undefined;
    if (!dealerId) continue;

    const users = await usersFor(dealerId);
    if (users.length === 0) continue;

    const payload = pushPayloadFor(lead);
    let delivered = false;
    for (const u of users) {
      try {
        await sendPushToUser(u.id, payload);
        delivered = true;
      } catch (e) {
        console.error('[leadNotify] push failed', e);
      }
    }
    if (delivered) pushed += 1;
  }

  if (toRecord.length > 0) {
    await prisma.leadNotified.createMany({
      data: toRecord.map((leadKey) => ({ leadKey })),
      skipDuplicates: true,
    });
  }

  return { configured: true, pushed, recorded: toRecord.length };
}

function pushPayloadFor(lead: Lead) {
  const who = shortName(lead.customerName);
  const service = (lead.service || '').trim();
  const body = service ? `${who} — ${service}. Call them soon.` : `${who} — a new lead just came in. Call them soon.`;
  return {
    title: 'New Home Depot lead',
    body,
    url: '/dealer/leads',
    // Collapse per lead so a re-send replaces rather than stacks.
    tag: `lead-${leadKeyOf(lead)}`,
  };
}
