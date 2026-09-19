'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

/**
 * A submit button that gives impatient users immediate, honest feedback and can't
 * be fired twice:
 *  - it disables itself the instant the form starts submitting (so a second tap
 *    does nothing — no duplicate deals / cancellations / uploads),
 *  - it swaps in a spinner and a "working…" label right away, and
 *  - once the wait passes ~2s it appends a live elapsed-seconds counter, so a slow
 *    save still visibly ticks instead of looking frozen.
 *
 * Must be rendered INSIDE a <form> that uses a server action — it reads that
 * form's pending state via useFormStatus.
 */
export function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  className = 'btn-primary',
  icon = null,
  disabled = false,
}: {
  idleLabel: ReactNode;
  pendingLabel: string;
  className?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!pending) {
      setSecs(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [pending]);

  return (
    <button
      type="submit"
      className={`${className} inline-flex items-center justify-center gap-2`}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {pending ? `${pendingLabel}${secs >= 2 ? ` · ${secs}s` : ''}` : idleLabel}
    </button>
  );
}
