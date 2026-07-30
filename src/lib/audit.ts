import { headers } from 'next/headers';
import { prisma } from './db';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'MFA_ENROLLED'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'CONTENT_CREATE'
  | 'CONTENT_UPDATE'
  | 'APPLICATION_CREATE'
  | 'APPLICATION_SUBMIT'
  | 'APPLICATION_UPDATE'
  | 'PII_DECRYPT'
  | 'DECISION'
  | 'STATUS_CHANGE'
  | 'DOC_UPLOAD'
  | 'DOC_DOWNLOAD'
  | 'FUNDING_SUBMIT'
  | 'FUNDING_DECISION'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'DEALER_CREATE'
  | 'DEALER_UPDATE';

interface AuditInput {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  detail?: string | null;
}

function clientIp(): string | null {
  try {
    const h = headers();
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Append an entry to the audit trail. Best-effort: an audit failure must never
 * crash the request, but is logged to the server console for investigation.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        detail: input.detail ?? null,
        ipAddress: clientIp(),
      },
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', input.action, err);
  }
}
