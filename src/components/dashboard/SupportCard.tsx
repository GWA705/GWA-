'use client';

import { LifeBuoy, ArrowRight, Headphones } from 'lucide-react';

/** Open the corner chat widget (ChatWidget listens for this event). */
function openChat() {
  window.dispatchEvent(new CustomEvent('gwa:open-chat', { detail: { support: true } }));
}

/**
 * Support / contact card. "Contact Support" opens the corner chat widget.
 *
 * The agent photo on the right is a swappable static asset: drop a file at
 * `public/support-agent.png` and it renders here, cropped to fill and blended
 * into the card. If the file is absent, a tasteful headset watermark shows
 * instead — so it never looks broken. See the AI image prompt in
 * `docs/BRAND-KIT.md` for generating a perfectly-formatted photo.
 */
export function SupportCard() {
  return (
    <div className="relative flex min-h-[168px] flex-col justify-between gap-4 overflow-hidden rounded-2xl bg-[#0e2b5c] p-5 text-white shadow-sm">
      {/* Agent photo — right side, cropped to fill. A left-edge mask feathers
          the photo so it bleeds into the card with no hard seam. The position
          keeps a right-of-centre face (like the supplied photo) in frame. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[62%] bg-cover bg-no-repeat sm:w-[58%]"
        style={{
          backgroundImage: "url('/support-agent.png')",
          backgroundPosition: '62% 16%',
          maskImage: 'linear-gradient(to right, transparent 0%, #000 46%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 46%)',
        }}
        aria-hidden
      />
      {/* Watermark shown when no photo is present (sits behind the photo) */}
      <Headphones className="pointer-events-none absolute -right-4 bottom-2 -z-0 text-white/5" size={140} aria-hidden />
      {/* Colour wash on the left keeps the text crisp over the feathered photo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0e2b5c] via-[#0e2b5c]/70 to-transparent" aria-hidden />

      <div className="relative z-10 max-w-[62%]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/10">
            <LifeBuoy size={22} className="text-sky-300" />
          </div>
          <div>
            <div className="text-lg font-bold">Need Support?</div>
            <div className="text-sm text-blue-100">We&rsquo;re here to help.</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-blue-100">
          Questions on a deal, funding, or the portal? Chat with the Georgian Water &amp; Air team right here.
        </p>
      </div>

      <button
        type="button"
        onClick={openChat}
        className="relative z-10 mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-[#ffffff] px-3.5 py-1.5 text-[13px] font-semibold text-[#0e2b5c] transition hover:bg-blue-50"
      >
        Contact Support <ArrowRight size={16} />
      </button>
    </div>
  );
}
