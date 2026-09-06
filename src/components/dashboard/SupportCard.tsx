'use client';

import { LifeBuoy, ArrowRight, Headphones } from 'lucide-react';
import { useT } from '@/i18n/client';

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
  const t = useT();
  return (
    <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-[#0e2b5c] p-4 text-white shadow-sm">
      {/* Agent photo — right side, cropped to fill. A left-edge mask feathers
          the photo so it bleeds into the card with no hard seam. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[44%] bg-cover bg-no-repeat"
        style={{
          backgroundImage: "url('/support-agent.png')",
          backgroundPosition: '60% 0%',
          maskImage: 'linear-gradient(to right, transparent 0%, #000 55%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 55%)',
        }}
        aria-hidden
      />
      {/* Watermark shown when no photo is present (sits behind the photo) */}
      <Headphones className="pointer-events-none absolute -right-3 bottom-1 -z-0 text-white/5" size={104} aria-hidden />
      {/* Colour wash on the left keeps the text crisp over the feathered photo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0e2b5c] via-[#0e2b5c]/75 to-transparent" aria-hidden />

      <div className="relative z-10 flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white/10">
          <LifeBuoy size={18} className="text-sky-300" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">{t('support.needSupport')}</div>
          <div className="truncate text-xs text-blue-100">{t('support.hereToHelp')}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={openChat}
        className="relative z-10 inline-flex flex-none items-center gap-1.5 rounded-lg bg-[#ffffff] px-3 py-1.5 text-xs font-semibold text-[#0e2b5c] transition hover:bg-blue-50"
      >
        {t('support.chat')} <ArrowRight size={14} />
      </button>
    </div>
  );
}
