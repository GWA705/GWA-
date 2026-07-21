import type { ApplicationStatus } from '@prisma/client';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants';

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>;
}
