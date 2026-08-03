'use server';

import { redirect } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';
import { getSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';
import { audit } from '@/lib/audit';

export interface OrderActionState {
  error?: string;
}

function appUrl(): string {
  return (process.env.APP_URL || '').replace(/\/$/, '');
}

/** A dealer submits a marketplace order. No prices/payment — it emails whoever
 *  handles fulfillment. */
export async function createOrderAction(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'Your account is not linked to a dealer.' };

  // Only orderable items — DOWNLOAD items are files, never part of an order.
  const items = await prisma.marketplaceItem.findMany({ where: { active: true, kind: 'ORDER' } });
  const note = (formData.get('note') ?? '').toString().trim() || null;

  const lines: { itemId: string; itemName: string; option: string | null; quantity: number }[] = [];
  for (const item of items) {
    const qty = Number.parseInt((formData.get(`qty_${item.id}`) ?? '0').toString(), 10);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const option = item.options.length > 0 ? (formData.get(`opt_${item.id}`) ?? '').toString() || null : null;
    lines.push({ itemId: item.id, itemName: item.name, option, quantity: Math.min(qty, 9999) });
  }

  if (lines.length === 0) return { error: 'Choose a quantity for at least one item.' };

  const order = await prisma.order.create({
    data: {
      dealerId: session.dealerId,
      createdById: session.userId,
      note,
      items: { create: lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, option: l.option, quantity: l.quantity })) },
    },
    include: { dealer: { select: { name: true } }, createdBy: { select: { name: true } } },
  });

  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'Order', entityId: order.id, detail: `${lines.length} item(s)` });

  // Email whoever handles fulfillment: the configured address, or all admins.
  try {
    const configured = await getSetting(MARKETPLACE_SETTING_KEYS.orderEmail);
    let recipients: string[] = [];
    if (configured) {
      recipients = [configured];
    } else {
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN', active: true }, select: { email: true, notificationEmail: true } });
      recipients = admins.map((a) => a.notificationEmail || a.email);
    }
    const listHtml = `<ul style="margin:0 0 14px;padding-left:18px;font-size:14px;line-height:1.7;color:#374151;">${lines
      .map((l) => `<li>${l.quantity} × ${l.itemName}${l.option ? ` — ${l.option}` : ''}</li>`)
      .join('')}</ul>`;
    for (const to of recipients) {
      await sendEmail({
        to,
        subject: `New marketplace order — ${order.dealer.name}`,
        html: renderEmail({
          heading: 'New marketplace order',
          intro: `${order.dealer.name} (submitted by ${order.createdBy.name}) ordered:`,
          bodyHtml: listHtml + (note ? `<p style="margin:0 0 14px;font-size:14px;color:#374151;"><strong>Note:</strong> ${note}</p>` : ''),
          ctaLabel: 'View orders',
          ctaUrl: `${appUrl()}/admin/marketplace`,
        }),
      });
    }
  } catch (e) {
    console.error('[marketplace] order email failed', e);
  }

  redirect('/dealer/marketplace?ok=1');
}
