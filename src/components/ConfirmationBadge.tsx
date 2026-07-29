import type { ConfirmationStatus } from '@prisma/client';
import { CONFIRMATION_STATUS_LABELS, CONFIRMATION_STATUS_COLORS } from '@/lib/constants';

export function ConfirmationBadge({ status }: { status: ConfirmationStatus }) {
  return (
    <span className={`badge ${CONFIRMATION_STATUS_COLORS[status]}`}>
      {CONFIRMATION_STATUS_LABELS[status]}
    </span>
  );
}
