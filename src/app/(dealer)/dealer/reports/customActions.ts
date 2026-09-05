'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import type { Prisma } from '@prisma/client';

export interface SavedReportConfig {
  measure: string;
  dimension: string;
  range: string;
  statuses: string[];
}

export interface SavedReportVM {
  id: string;
  name: string;
  config: SavedReportConfig;
}

const MEASURES = ['count', 'total', 'avg'];
const DIMENSIONS = ['ym', 'program', 'status', 'salesperson', 'province', 'product'];
const RANGES = ['all', 'ytd', '12m', '3m'];

/** Save (or rename-overwrite) a named custom report for this office. */
export async function saveCustomReport(input: { name: string; config: SavedReportConfig }): Promise<{ id: string; name: string } | { error: string }> {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user))) return { error: 'Not allowed.' };

  const name = (input?.name ?? '').trim().slice(0, 80);
  if (!name) return { error: 'Give the report a name.' };

  const c = input?.config;
  if (!c || !MEASURES.includes(c.measure) || !DIMENSIONS.includes(c.dimension) || !RANGES.includes(c.range)) {
    return { error: 'That report setup isn’t valid.' };
  }
  const config: SavedReportConfig = {
    measure: c.measure,
    dimension: c.dimension,
    range: c.range,
    statuses: Array.isArray(c.statuses) ? c.statuses.filter((s) => typeof s === 'string').slice(0, 30) : [],
  };

  try {
    const row = await prisma.savedReport.create({
      data: { userId: user.userId, dealerId: user.dealerId ?? null, name, config: config as unknown as Prisma.InputJsonObject },
      select: { id: true, name: true },
    });
    revalidatePath('/dealer/reports/custom');
    return row;
  } catch {
    return { error: 'Couldn’t save right now — please try again.' };
  }
}

/** Delete a saved report (must belong to this office). */
export async function deleteCustomReport(id: string): Promise<{ ok: true } | { error: string }> {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user))) return { error: 'Not allowed.' };
  try {
    const row = await prisma.savedReport.findUnique({ where: { id }, select: { dealerId: true, userId: true } });
    if (!row) return { error: 'Not found.' };
    const ownsIt = (user.dealerId && row.dealerId === user.dealerId) || row.userId === user.userId;
    if (!ownsIt) return { error: 'Not allowed.' };
    await prisma.savedReport.delete({ where: { id } });
    revalidatePath('/dealer/reports/custom');
    return { ok: true };
  } catch {
    return { error: 'Couldn’t delete right now — please try again.' };
  }
}
