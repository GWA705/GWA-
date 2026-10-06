'use client';

import type { ApplicationStatus } from '@prisma/client';
import { STATUS_BUCKET, barChipClass } from '@/lib/chipStyle';
import { useT } from '@/i18n/client';

export function StatusBadge({ status, short = false }: { status: ApplicationStatus; short?: boolean }) {
  const t = useT();
  const label = t(`enum.${short ? 'statusShort' : 'status'}.${status}`);
  return <span className={barChipClass(STATUS_BUCKET[status])}>{label}</span>;
}
