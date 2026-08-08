import type { ApplicationStatus } from '@prisma/client';
import { STATUS_COLORS, STATUS_LABELS, STATUS_LABELS_SHORT } from '@/lib/constants';

export function StatusBadge({ status, short = false }: { status: ApplicationStatus; short?: boolean }) {
  const label = short ? STATUS_LABELS_SHORT[status] : STATUS_LABELS[status];
  return <span className={`badge whitespace-nowrap ${STATUS_COLORS[status]}`}>{label}</span>;
}
