import Link from 'next/link';
import { LifeBuoy, ArrowRight } from 'lucide-react';

/** Support / contact card. Links to the dealer Contact / Support page. */
export function SupportCard() {
  return (
    <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-[#0e2b5c] p-6 text-white shadow-sm">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <LifeBuoy size={22} className="text-sky-300" />
          </div>
          <div>
            <div className="text-lg font-bold">Need Support?</div>
            <div className="text-sm text-blue-100">We&rsquo;re here to help.</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-blue-100">
          Questions on a deal, funding, or the portal? Reach the Georgian Water &amp; Air team — or use the chat bubble
          in the corner.
        </p>
      </div>
      <Link
        href="/dealer/support"
        className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0e2b5c] hover:bg-blue-50"
      >
        Contact Support <ArrowRight size={16} />
      </Link>
    </div>
  );
}
