'use server';

import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { sendEmail, type EmailAttachment } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';
import { getDocument } from '@/lib/storage';
import { getSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';
import { audit } from '@/lib/audit';

export interface OrderActionState {
  error?: string;
  ok?: boolean;
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

  // The cart arrives as a JSON array of { itemId, option, quantity } lines — one
  // per size, so the same item can appear more than once (e.g. 3×S and 3×L).
  const byId = new Map(items.map((i) => [i.id, i]));
  let cart: unknown = [];
  try {
    cart = JSON.parse((formData.get('cart') ?? '[]').toString());
  } catch {
    cart = [];
  }

  const lines: { itemId: string; itemName: string; partNumber: string | null; option: string | null; quantity: number }[] = [];
  if (Array.isArray(cart)) {
    for (const raw of cart.slice(0, 500)) {
      const c = raw as { itemId?: unknown; option?: unknown; quantity?: unknown };
      const item = typeof c.itemId === 'string' ? byId.get(c.itemId) : undefined;
      if (!item) continue;
      const qty = Number.parseInt(String(c.quantity ?? ''), 10);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      // Only accept an option the item actually offers; otherwise fall back.
      const option =
        item.options.length > 0
          ? typeof c.option === 'string' && item.options.includes(c.option)
            ? c.option
            : item.options[0]
          : null;
      lines.push({ itemId: item.id, itemName: item.name, partNumber: item.partNumber, option, quantity: Math.min(qty, 9999) });
    }
  }

  if (lines.length === 0) return { error: 'Add at least one item to your cart before submitting.' };

  const order = await prisma.order.create({
    data: {
      dealerId: session.dealerId,
      createdById: session.userId,
      note,
      items: { create: lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, partNumber: l.partNumber, option: l.option, quantity: l.quantity })) },
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

    // Attach each ordered item's photo inline, so the email shows a small
    // thumbnail beside every line. Load each item's image once (deduped), and
    // skip any that fail so a missing image never blocks the email.
    const attachments: EmailAttachment[] = [];
    const cidByItem = new Map<string, string>();
    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.itemId)) continue;
      seen.add(l.itemId);
      const item = byId.get(l.itemId);
      if (!item?.imageStorageKey) continue;
      try {
        const bytes = await getDocument(item.imageStorageKey);
        const cid = `item-${l.itemId}@gwa`;
        const ext = (item.imageMime?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        attachments.push({
          filename: `${l.itemName}.${ext}`.replace(/[^\w.\- ]/g, '_'),
          content: bytes,
          contentType: item.imageMime || 'image/jpeg',
          cid,
        });
        cidByItem.set(l.itemId, cid);
      } catch (e) {
        console.error('[marketplace] order image attach failed', l.itemId, e);
      }
    }

    const rowsHtml = lines
      .map((l) => {
        const cid = cidByItem.get(l.itemId);
        const thumb = cid
          ? `<td style="width:60px;padding:6px 12px 6px 0;vertical-align:middle;"><img src="cid:${cid}" width="48" height="48" alt="" style="width:48px;height:48px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;background:#fff;"></td>`
          : '<td style="width:0;padding:0;"></td>';
        const part = l.partNumber
          ? `<span style="margin-left:8px;font-family:monospace;font-size:12px;color:#6b7280;">#${l.partNumber}</span>`
          : '';
        return `<tr>${thumb}<td style="padding:6px 0;font-size:14px;color:#374151;vertical-align:middle;"><strong>${l.quantity} ×</strong> ${l.itemName}${l.option ? ` — ${l.option}` : ''}${part}</td></tr>`;
      })
      .join('');
    const listHtml = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-collapse:collapse;">${rowsHtml}</table>`;

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
        attachments,
      });
    }
  } catch (e) {
    console.error('[marketplace] order email failed', e);
  }

  // Return success rather than redirect(): a redirect() thrown from inside a
  // useFormState action surfaces as an error to the dealer on Next 14 (the order
  // still saves). The client clears the cart and shows the confirmation.
  return { ok: true };
}
