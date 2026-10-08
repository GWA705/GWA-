'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { notifyNewNote } from '@/lib/notify';
import { findCardData, CARD_BLOCK_MESSAGE } from '@/lib/cardscan';
import { nextCaseNumber } from '@/lib/resolutionCases';
import { isResolutionStatus, STATUS_LABEL, OPEN_STATUSES, PRIORITIES } from '@/lib/resolutionStatus';
import { normalizeCallPhone } from '@/lib/customerCalls';
import { putDocument, deleteDocument, newResolutionStorageKey } from '@/lib/storage';
import { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } from '@/lib/constants';
import { gmailResolutionConfigured, searchThreadForRef, fetchFirstMessageText, fetchLatestInboundText, fetchMessageText } from '@/lib/gmailResolution';
import { summarizeResolutionEmail, draftHdReply, aiConfigured } from '@/lib/ai';
import { decodeEntities } from '@/lib/htmlEntities';
import { syncCaseEmails } from '@/lib/resolutionEmailSync';
import type { ResolutionStatus, Prisma } from '@prisma/client';

// Identify a file by its magic bytes (don't trust the client-declared MIME).
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === '%PDF') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return 'image/png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12).toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis', 'hevm', 'hevs', 'heif'].includes(brand)) return 'image/heic';
  }
  return null;
}
const EXT_FOR: Record<string, string> = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic',
};

export interface CaseFormState {
  error?: string;
  ok?: boolean;
}

/** Open a new HD resolution case. Optionally prefilled from a deal (applicationId). */
export async function createCaseAction(_prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');

  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const rawPriority = String(formData.get('priority') || 'normal');
  const priority = (PRIORITIES as readonly string[]).includes(rawPriority) ? rawPriority : 'normal';
  const applicationId = String(formData.get('applicationId') || '').trim() || null;
  if (title.length < 2) return { error: 'Give the case a short title.' };
  if (description.length < 2) return { error: 'Describe the problem.' };

  let customerName = String(formData.get('customerName') || '').trim();
  let customerPhone = String(formData.get('customerPhone') || '').trim();
  let hdReference = String(formData.get('hdReference') || '').trim() || null;
  const hdCaseNumber = String(formData.get('hdCaseNumber') || '').trim() || null;
  let officeDealerId: string | null = null;

  if (applicationId) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { applicantFirstName: true, applicantLastName: true, applicantPhone: true, hdReference: true, dealerId: true },
    });
    if (!app) return { error: 'Linked deal not found.' };
    // Deal values FILL BLANKS only — a staff member's typed edits win, so they can
    // correct the auto-filled name/phone before opening the case.
    customerName = customerName || `${app.applicantFirstName} ${app.applicantLastName}`.trim();
    customerPhone = customerPhone || app.applicantPhone || '';
    hdReference = hdReference || app.hdReference || null;
    officeDealerId = app.dealerId;
  }
  if (!customerName) return { error: 'Enter the customer name (or link a deal).' };

  // Optionally link a Gmail thread (from the unlinked-email inbox).
  const gmailThreadId = String(formData.get('gmailThreadId') || '').trim() || null;

  const caseNumber = await nextCaseNumber();
  const created = await prisma.resolutionCase.create({
    data: {
      caseNumber, title, description, priority, applicationId,
      customerName, customerPhone: normalizeCallPhone(customerPhone),
      officeDealerId, hdReference, hdCaseNumber, openedById: user.userId,
      ...(gmailThreadId ? { gmailThreadId, gmailLinkedAt: new Date() } : {}),
    },
  });
  if (gmailThreadId) {
    try { await syncCaseEmails(created.id); } catch { /* best-effort; Sync button retries */ }
  }
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: created.id, detail: `Opened HD resolution case ${caseNumber}` });
  revalidatePath('/staff/resolutions');
  redirect(`/staff/resolutions/${created.id}`);
}

/**
 * Read the first HD email of a thread and summarize it into a problem statement
 * (for the "✨ Summarize the HD email" button on the new-case form). Read-only;
 * returns the summary text or a friendly error. Does not create anything.
 */
export async function summarizeEmailAction(gmailThreadId: string): Promise<{ text?: string; error?: string }> {
  await requireRole('REVIEWER', 'ADMIN');
  const threadId = (gmailThreadId || '').trim();
  if (!threadId) return { error: 'No email thread selected.' };
  if (!gmailResolutionConfigured()) return { error: 'The Gmail email link isn’t set up yet.' };
  if (!aiConfigured()) return { error: 'The AI summary isn’t available (no AI key configured).' };

  let body: string | null = null;
  try {
    body = await fetchFirstMessageText(threadId);
  } catch (e) {
    console.error('[resolution-email] body fetch failed', e);
    return { error: 'Couldn’t read the email from Gmail. Try again.' };
  }
  if (!body) return { error: 'Couldn’t find any text in that email to summarize.' };

  const summary = await summarizeResolutionEmail(body);
  if (!summary) return { error: 'The AI couldn’t summarize this one — paste the key points by hand.' };
  return { text: summary };
}

/**
 * Draft a professional reply to the HD rep from the case's notes (+ HD's latest
 * email when the thread is linked). For REVIEW — returns the draft text, sends
 * nothing. The portal's Gmail access is read-only, so the draft is copied into
 * Gmail to send.
 */
export async function draftHdReplyAction(caseId: string): Promise<{ text?: string; error?: string }> {
  await requireRole('REVIEWER', 'ADMIN');
  if (!aiConfigured()) return { error: 'The AI drafter isn’t available (no AI key configured).' };
  const c = await prisma.resolutionCase.findUnique({
    where: { id: caseId },
    select: {
      customerName: true, description: true, gmailThreadId: true,
      notes: { where: { statusTo: null }, orderBy: { createdAt: 'asc' }, select: { body: true } },
    },
  });
  if (!c) return { error: 'Case not found.' };

  const noteLines = c.notes.map((n) => (n.body || '').trim()).filter(Boolean);
  const notesBlob = [
    c.description?.trim() ? `Problem:\n${c.description.trim()}` : '',
    noteLines.length ? `Notes:\n${noteLines.map((l) => `- ${l}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  if (notesBlob.replace(/\s/g, '').length < 5) {
    return { error: 'Add a note about what you want to say first, then draft the reply.' };
  }

  let latestEmail: string | null = null;
  if (c.gmailThreadId && gmailResolutionConfigured()) {
    try { latestEmail = await fetchLatestInboundText(c.gmailThreadId); } catch { /* best-effort */ }
  }

  const draft = await draftHdReply({ notes: notesBlob, latestEmail, customerName: c.customerName, hdRepName: null });
  if (!draft) return { error: 'The AI couldn’t draft a reply — try again or write it by hand.' };
  return { text: draft };
}

/** Add a plain note to a case's activity thread. */
export async function addCaseNoteAction(caseId: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const body = String(formData.get('body') || '').trim();
  if (body.length < 1) return { error: 'Write a note.' };
  if (body.length > 4000) return { error: 'Note is too long.' };
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return { error: 'Case not found.' };
  await prisma.resolutionCaseNote.create({ data: { caseId, authorId: user.userId, body } });
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}

/**
 * Save the contact card — customer + spouse + HD rep + ad-hoc extra contacts.
 * Customer name is kept if left blank (it's required); everything else can be
 * cleared. Extra contacts come in as parallel arrays (extraName/Role/Phone/Email).
 */
export async function updateCaseContactAction(caseId: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return { error: 'Case not found.' };

  const opt = (k: string, max = 200): string | null => {
    const v = String(formData.get(k) || '').trim();
    return v ? v.slice(0, max) : null;
  };

  // Ad-hoc extra contacts (parallel arrays), empties dropped, capped at 12.
  const names = formData.getAll('extraName').map(String);
  const roles = formData.getAll('extraRole').map(String);
  const phones = formData.getAll('extraPhone').map(String);
  const emails = formData.getAll('extraEmail').map(String);
  const extra: { name: string; role: string; phone: string; email: string }[] = [];
  for (let i = 0; i < names.length; i += 1) {
    const name = (names[i] || '').trim().slice(0, 80);
    const role = (roles[i] || '').trim().slice(0, 60);
    const phone = (phones[i] || '').trim().slice(0, 40);
    const email = (emails[i] || '').trim().slice(0, 160);
    if (name || phone || email) extra.push({ name, role, phone, email });
    if (extra.length >= 12) break;
  }

  const data: Prisma.ResolutionCaseUpdateInput = {
    customerEmail: opt('customerEmail', 160),
    customerAddress: opt('customerAddress', 300),
    spouseName: opt('spouseName', 120),
    spousePhone: opt('spousePhone', 40),
    hdRepName: opt('hdRepName', 120),
    hdRepPhone: opt('hdRepPhone', 40),
    hdRepEmail: opt('hdRepEmail', 160),
    extraContacts: extra,
  };
  const customerName = opt('customerName', 120);
  if (customerName) data.customerName = customerName; // required — only overwrite when given
  const phoneRaw = String(formData.get('customerPhone') || '').trim();
  if (phoneRaw) data.customerPhone = normalizeCallPhone(phoneRaw); // keep normalized for lookups

  await prisma.resolutionCase.update({ where: { id: caseId }, data });
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: caseId, detail: 'updated contact card' });
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}

/** Move a case to a new status; records the transition on the activity thread. */
export async function updateCaseStatusAction(caseId: string, status: string): Promise<void> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isResolutionStatus(status)) return;
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true, status: true } });
  if (!c || c.status === status) return;

  const data: Prisma.ResolutionCaseUpdateInput = { status: status as ResolutionStatus };
  if (status === 'RESOLVED') data.resolvedAt = new Date();
  else if (OPEN_STATUSES.includes(status as ResolutionStatus)) data.resolvedAt = null;
  // CLOSED: leave resolvedAt as-is.

  await prisma.$transaction([
    prisma.resolutionCase.update({ where: { id: caseId }, data }),
    prisma.resolutionCaseNote.create({
      data: {
        caseId, authorId: user.userId,
        body: `Status changed to ${STATUS_LABEL[status as ResolutionStatus]}.`,
        statusFrom: c.status, statusTo: status as ResolutionStatus,
      },
    }),
  ]);
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: caseId, detail: `${c.status} → ${status}` });
  revalidatePath(`/staff/resolutions/${caseId}`);
  revalidatePath('/staff/resolutions');
}

/** Assign (or unassign with '') a case to an internal staff member. */
export async function assignCaseAction(caseId: string, assignedToId: string): Promise<void> {
  await requireRole('REVIEWER', 'ADMIN');
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return;
  const id = assignedToId || null;
  if (id) {
    const u = await prisma.user.findFirst({ where: { id, role: { in: ['REVIEWER', 'ADMIN'] }, active: true }, select: { id: true } });
    if (!u) return;
  }
  await prisma.resolutionCase.update({ where: { id: caseId }, data: { assignedToId: id } });
  revalidatePath(`/staff/resolutions/${caseId}`);
}

/**
 * Notify the office that owns the customer (one-way). Reuses the proven
 * dealer-visible-note + notification path, so the case must be linked to a deal
 * (that's how we reach the office).
 */
export async function notifyOfficeAction(caseId: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const message = String(formData.get('message') || '').trim();
  if (message.length < 2) return { error: 'Write a message for the office.' };
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true, caseNumber: true, applicationId: true } });
  if (!c) return { error: 'Case not found.' };
  if (!c.applicationId) return { error: 'Link this case to the customer’s deal first, so we can reach their office.' };

  const card = findCardData(message);
  if (card.blocked) {
    await audit({ actorId: user.userId, action: 'CARD_DATA_BLOCKED', entityType: 'ResolutionCase', entityId: caseId, detail: 'office notify blocked — card data detected' });
    return { error: CARD_BLOCK_MESSAGE };
  }

  await prisma.note.create({ data: { applicationId: c.applicationId, authorId: user.userId, body: `🧰 HD Resolution (${c.caseNumber}) — ${message}`, internal: false } });
  await notifyNewNote(c.applicationId, 'REVIEWER');
  await prisma.resolutionCaseNote.create({ data: { caseId, authorId: user.userId, body: `Notified the office: ${message}` } });
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: caseId, detail: 'notified office' });
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}

/** Upload a file (photo / PDF) to a case. Encrypted at rest; MIME sniffed. */
export async function uploadCaseFileAction(caseId: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return { error: 'Case not found.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to upload.' };
  if (file.size > MAX_FILE_BYTES) return { error: `File is too large (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB).` };

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !ALLOWED_MIME_TYPES.includes(mime)) return { error: 'Unsupported file type. Use a PDF or an image (JPG, PNG, HEIC, WebP).' };

  const label = String(formData.get('label') || '').trim() || file.name;
  const key = newResolutionStorageKey(caseId, EXT_FOR[mime] || '.bin');
  await putDocument(key, buf);
  await prisma.resolutionAttachment.create({
    data: { caseId, kind: 'file', label, fileName: file.name, mimeType: mime, sizeBytes: buf.length, storageKey: key, addedById: user.userId },
  });
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: caseId, detail: `attached file to case` });
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}

/** Attach a resource LINK (e.g. a resource-library manual URL) to a case. */
export async function addCaseLinkAction(caseId: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return { error: 'Case not found.' };

  const url = String(formData.get('url') || '').trim();
  const label = String(formData.get('label') || '').trim();
  if (!/^https?:\/\/.+/i.test(url)) return { error: 'Enter a full link starting with http:// or https://' };
  if (!label) return { error: 'Give the link a short label.' };

  await prisma.resolutionAttachment.create({ data: { caseId, kind: 'link', label, url, addedById: user.userId } });
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}

/** Remove an attachment (and its stored file, if any) from a case. */
export async function deleteCaseAttachmentAction(attachmentId: string): Promise<void> {
  await requireRole('REVIEWER', 'ADMIN');
  const a = await prisma.resolutionAttachment.findUnique({ where: { id: attachmentId }, select: { id: true, caseId: true, storageKey: true } });
  if (!a) return;
  if (a.storageKey) {
    try { await deleteDocument(a.storageKey); } catch { /* best-effort; still remove the row */ }
  }
  await prisma.resolutionAttachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/staff/resolutions/${a.caseId}`);
}

/** Link this case to its HD email thread by searching Gmail for the ref / case #. */
export async function linkEmailThreadAction(caseId: string, _prev: CaseFormState, _formData: FormData): Promise<CaseFormState> {
  await requireRole('REVIEWER', 'ADMIN');
  if (!gmailResolutionConfigured()) return { error: 'The Gmail email link isn’t set up yet.' };
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true, hdCaseNumber: true, hdReference: true, caseNumber: true, gmailThreadId: true } });
  if (!c) return { error: 'Case not found.' };
  if (c.gmailThreadId) return { ok: true };

  // HD keys their emails by the CASE # (in the subject), so match on that first;
  // fall back to the HD Customer # or our own case number.
  const ref = (c.hdCaseNumber || c.hdReference || c.caseNumber || '').trim();
  if (!ref) return { error: 'Add the HD Case # to this case first, so we can find the email.' };

  let found: { threadId: string; subject: string } | null = null;
  try {
    found = await searchThreadForRef(ref);
  } catch (e) {
    console.error('[resolution-email] search failed', e);
    return { error: 'Couldn’t reach Gmail. Check the email setup and try again.' };
  }
  if (!found) return { error: `No HD email found for "${ref}" under the resolution label.` };

  await prisma.resolutionCase.update({ where: { id: caseId }, data: { gmailThreadId: found.threadId, gmailLinkedAt: new Date() } });
  try { await syncCaseEmails(caseId); } catch { /* best-effort */ }
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}

/** Read one linked email's FULL body in the portal ("read full message"). */
export async function fetchEmailBodyAction(caseId: string, gmailMessageId: string): Promise<{ text?: string; error?: string }> {
  await requireRole('REVIEWER', 'ADMIN');
  if (!gmailResolutionConfigured()) return { error: 'The Gmail email link isn’t set up.' };
  // Only a message already synced to THIS case can be fetched.
  const row = await prisma.resolutionEmail.findFirst({ where: { caseId, gmailMessageId }, select: { id: true } });
  if (!row) return { error: 'Message not found on this case.' };
  try {
    const body = await fetchMessageText(gmailMessageId);
    if (!body) return { error: 'Couldn’t load the full message — open it in Gmail.' };
    return { text: decodeEntities(body) };
  } catch (e) {
    console.error('[resolution-email] full-body fetch failed', e);
    return { error: 'Couldn’t reach Gmail. Try again.' };
  }
}

/** Pull new replies from the linked email thread now. */
export async function syncEmailThreadAction(caseId: string): Promise<void> {
  await requireRole('REVIEWER', 'ADMIN');
  if (!gmailResolutionConfigured()) return;
  try { await syncCaseEmails(caseId); } catch (e) { console.error('[resolution-email] manual sync failed', e); }
  revalidatePath(`/staff/resolutions/${caseId}`);
}

/** Unlink the email thread and drop its synced messages from this case. */
export async function unlinkEmailThreadAction(caseId: string): Promise<void> {
  await requireRole('REVIEWER', 'ADMIN');
  await prisma.$transaction([
    prisma.resolutionEmail.deleteMany({ where: { caseId } }),
    prisma.resolutionCase.update({ where: { id: caseId }, data: { gmailThreadId: null, gmailLinkedAt: null, emailSyncedAt: null } }),
  ]);
  revalidatePath(`/staff/resolutions/${caseId}`);
}
