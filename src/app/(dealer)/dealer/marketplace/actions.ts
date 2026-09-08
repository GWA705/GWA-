'use server';

import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { sendEmail, type EmailAttachment } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';
import { getDocument } from '@/lib/storage';
import { getSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';
import { audit } from '@/lib/audit';
import { MARKETPLACE_SHIPPING_METHOD_VALUES } from '@/lib/constants';
import { buildOrderPdf } from '@/lib/orderPdf';

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

  // Shipping method the dealer chose (so the shipper knows how to send it). Only
  // accept a value from the known list; otherwise leave it unset.
  const rawMethod = (formData.get('shippingMethod') ?? '').toString().trim();
  const shippingMethod = MARKETPLACE_SHIPPING_METHOD_VALUES.includes(rawMethod) ? rawMethod : null;

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
      // Part number for the chosen size (falls back to the item's base part number).
      const idx = option ? item.options.indexOf(option) : -1;
      const partNumber = (idx >= 0 ? (item.optionSkus?.[idx] || '').trim() : '') || item.partNumber;
      lines.push({ itemId: item.id, itemName: item.name, partNumber, option, quantity: Math.min(qty, 9999) });
    }
  }

  if (lines.length === 0) return { error: 'Add at least one item to your cart before submitting.' };

  const order = await prisma.order.create({
    data: {
      dealerId: session.dealerId,
      createdById: session.userId,
      note,
      shippingMethod,
      items: { create: lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, partNumber: l.partNumber, option: l.option, quantity: l.quantity })) },
    },
    include: {
      dealer: {
        select: {
          name: true,
          profile: {
            select: { businessName: true, address: true, shippingAddress: true, phone: true, altPhone: true },
          },
        },
      },
      createdBy: { select: { name: true } },
    },
  });

  // Dealer ship-to details for the shipper (prefer the profile's shipping
  // address, then the general address). Business name overrides the dealer name
  // when set.
  const profile = order.dealer.profile;
  const shipToName = (profile?.businessName || order.dealer.name).trim();
  const shipToAddress = (profile?.shippingAddress || profile?.address || '').trim() || null;
  const dealerPhone = (profile?.phone || '').trim() || null;
  const dealerAltPhone = (profile?.altPhone || '').trim() || null;

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

    // Attach a print-ready packing slip PDF so the shipper can print & pack
    // straight from the email. A PDF failure must never block the email.
    try {
      const pdfBytes = await buildOrderPdf({
        orderId: order.id,
        createdAt: order.createdAt,
        dealerName: shipToName,
        shipTo: shipToAddress,
        phone: dealerPhone,
        altPhone: dealerAltPhone,
        submittedBy: order.createdBy.name,
        shippingMethod: order.shippingMethod,
        note,
        lines: lines.map((l) => ({ quantity: l.quantity, itemName: l.itemName, option: l.option, partNumber: l.partNumber })),
      });
      const slug = shipToName.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'order';
      attachments.push({
        filename: `packing-slip-${slug}-${order.id.slice(-6)}.pdf`,
        content: pdfBytes,
        contentType: 'application/pdf',
      });
    } catch (e) {
      console.error('[marketplace] order PDF build failed', e);
    }

    // Ship-to + shipping-method block for the shipper (escaped — dealer-entered).
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const addrLines = (shipToAddress ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    const phones = [dealerPhone, dealerAltPhone].filter(Boolean) as string[];
    const shipToHtml =
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-collapse:collapse;width:100%;">` +
      `<tr><td style="padding:12px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">` +
      `<div style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">Ship to</div>` +
      `<div style="font-size:15px;font-weight:700;color:#111827;">${esc(shipToName)}</div>` +
      (addrLines.length
        ? `<div style="font-size:13px;color:#374151;line-height:1.5;margin-top:2px;">${addrLines.map(esc).join('<br>')}</div>`
        : `<div style="font-size:13px;color:#b45309;margin-top:2px;">No address on file — confirm with the dealer.</div>`) +
      (phones.length ? `<div style="font-size:13px;color:#374151;margin-top:4px;"><strong>Phone:</strong> ${phones.map(esc).join(' / ')}</div>` : '') +
      `<div style="font-size:13px;color:#374151;margin-top:8px;"><strong>Shipping method:</strong> ${esc(order.shippingMethod || 'Not specified')}</div>` +
      `</td></tr></table>`;

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
          bodyHtml:
            shipToHtml +
            listHtml +
            (note ? `<p style="margin:0 0 14px;font-size:14px;color:#374151;"><strong>Note:</strong> ${note}</p>` : '') +
            `<p style="margin:0 0 14px;font-size:13px;color:#6b7280;">📎 A print-ready packing slip is attached as a PDF.</p>`,
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
