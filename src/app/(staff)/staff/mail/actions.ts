'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { putDocument, newMailStorageKey } from '@/lib/storage';
import { sha256 } from '@/lib/crypto';
import { audit } from '@/lib/audit';
import { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } from '@/lib/constants';
import { friendlyFileName } from '@/lib/filenames';
import { optimizeAttachmentImage } from '@/lib/image';

// Swap a filename's extension (used when an image is converted, e.g. HEIC→JPG).
function replaceExt(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}${ext}`;
}

export interface MailActionState {
  error?: string;
}

/** Admins/Reviewers compose and send mail to dealers, with file attachments. */
export async function sendMailAction(_prev: MailActionState, formData: FormData): Promise<MailActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');

  const subject = (formData.get('subject') ?? '').toString().trim();
  const body = (formData.get('body') ?? '').toString().trim();
  const senderLabel = (formData.get('senderLabel') ?? '').toString().trim() || null;
  const requireAck = formData.get('requireAck') === 'on';
  const allDealers = formData.get('allDealers') === 'on';
  const dealerIds = formData.getAll('dealerIds').map(String).filter(Boolean);

  if (!subject) return { error: 'Add a subject.' };
  if (!body) return { error: 'Add a message.' };
  if (!allDealers && dealerIds.length === 0) {
    return { error: 'Choose at least one dealer, or select “All dealers.”' };
  }

  const recipients = allDealers
    ? []
    : await prisma.dealer.findMany({ where: { id: { in: dealerIds }, active: true }, select: { id: true } });
  if (!allDealers && recipients.length === 0) {
    return { error: 'None of the selected dealers were found.' };
  }

  // Validate attachments up-front so we don't create a half-formed mail.
  const files = (formData.getAll('files') as File[]).filter((f) => f && typeof f !== 'string' && f.size > 0);
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return { error: `“${f.name}” exceeds the ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB limit.` };
    }
    if (!ALLOWED_MIME_TYPES.includes(f.type)) {
      return { error: `“${f.name}” is an unsupported file type. Use PDF or image files.` };
    }
  }

  const mail = await prisma.mail.create({
    data: {
      subject,
      body,
      senderLabel,
      requireAck,
      allDealers,
      senderId: session.userId,
      recipients: allDealers ? undefined : { create: recipients.map((d) => ({ dealerId: d.id })) },
    },
  });

  // Optional per-file display names typed by the sender, aligned by index.
  const customNames = formData.getAll('fileNames').map(String);

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    try {
      let bytes = Buffer.from(await file.arrayBuffer());
      let mimeType = file.type;
      const origExt = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
      let ext = origExt;

      // Shrink large image attachments while keeping them clearly readable.
      // PDFs and other files are stored untouched. Any failure — or a result
      // that isn't actually smaller — falls back to the original bytes.
      if (file.type.startsWith('image/')) {
        try {
          const opt = await optimizeAttachmentImage(bytes, file.type);
          if (opt && opt.bytes.length < bytes.length) {
            bytes = Buffer.from(opt.bytes);
            mimeType = opt.mime;
            ext = opt.ext;
          }
        } catch (e) {
          console.error('[mail] attachment optimize failed, storing original', e);
        }
      }

      // Prefer the sender's name; keep the real extension if they left it off.
      // Fall back to a cleaned-up version of the device filename (with the
      // extension corrected if the image format was converted).
      const typed = (customNames[i] ?? '').trim();
      let displayName: string;
      if (typed) {
        displayName = ext && !typed.toLowerCase().endsWith(ext.toLowerCase()) ? `${typed}${ext}` : typed;
      } else {
        const friendly = friendlyFileName(file.name);
        displayName = ext !== origExt ? replaceExt(friendly, ext) : friendly;
      }
      const key = newMailStorageKey(ext);
      await putDocument(key, bytes);
      await prisma.mailAttachment.create({
        data: {
          mailId: mail.id,
          fileName: displayName.slice(0, 255),
          mimeType,
          sizeBytes: bytes.length,
          storageKey: key,
          checksum: sha256(bytes),
        },
      });
    } catch (err) {
      console.error('[mail] attachment store failed', err);
      return { error: `Couldn’t save “${file.name}”. The mail was not sent — try again.` };
    }
  }

  await audit({
    actorId: session.userId,
    action: 'MAIL_SEND',
    entityType: 'Mail',
    entityId: mail.id,
    detail: `${allDealers ? 'all dealers' : `${recipients.length} dealer(s)`}${requireAck ? ', acknowledgement required' : ''}`,
  });

  revalidatePath('/staff/mail');
  redirect(`/staff/mail/${mail.id}`);
}
