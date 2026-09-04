import Link from 'next/link';
import { Droplets, ArrowRight } from 'lucide-react';

/** Marketplace promo tile. Links to the real marketplace. */
export function PromoCard() {
  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#073b83] to-[#0875ce] p-7 text-white shadow-sm">
      <div className="relative z-10 max-w-[65%]">
        <h3 className="text-3xl font-extrabold leading-tight">Better Water.<br />Brighter Lives.</h3>
        <p className="mt-4 text-sm text-blue-50">Quality products.<br />Stronger partnerships.<br />A healthier tomorrow.</p>
        <Link
          href="/dealer/marketplace"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Explore Products <ArrowRight size={16} />
        </Link>
      </div>
      <Droplets size={180} className="absolute -bottom-6 -right-4 opacity-15" />
    </div>
  );
}
