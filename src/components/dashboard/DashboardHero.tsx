import { DashboardGreeting } from '@/components/DashboardGreeting';

/**
 * The dashboard hero banner — a wide photographic welcome.
 *
 * The background is a swappable static asset: drop a file at
 * `public/hero-banner.jpg` and it fills the banner (cropped to cover). Until one
 * is added, an on-brand blue gradient shows instead — so it always looks
 * finished. A left-to-right dark gradient keeps the greeting legible over any
 * photo. See the AI image prompt in `docs/BRAND-KIT.md` §14 for a
 * perfectly-formatted background. The "Better Water / Brighter Lives" flourish
 * is live text (crisp at any size), so the photo itself should carry no text.
 */
export function DashboardHero({ firstName }: { firstName: string; companyName?: string | null }) {
  return (
    <section className="relative overflow-hidden rounded-2xl text-white shadow-sm">
      {/* Base gradient — shows through when no photo is present */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#04213f] via-[#0a3f82] to-[#0f68c9]" aria-hidden />
      {/* Swappable photo */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-banner.jpg')" }}
        aria-hidden
      />
      {/* Left-to-right legibility wash over the photo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#03152f] via-[#062a56]/85 to-[#062a56]/10" aria-hidden />

      <div className="relative z-10 flex min-h-[196px] items-center justify-between gap-6 px-6 py-8 sm:min-h-[212px] sm:px-10">
        <div className="max-w-2xl">
          <DashboardGreeting
            firstName={firstName}
            withIcon
            className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-4xl"
          />
          <p className="mt-2 text-xl font-bold text-white sm:text-2xl">Welcome to your Dealer Portal</p>
          <p className="mt-1.5 max-w-xl text-sm text-blue-100/90 sm:text-base">
            Everything you need to manage, process and grow your business — all in one place.
          </p>
        </div>

        {/* Script flourish — live text so it stays crisp (photo carries no text) */}
        <div
          className="hidden flex-none pr-1 text-right leading-[1.15] text-sky-50/95 drop-shadow lg:block"
          style={{ fontFamily: "'Great Vibes', 'Segoe Script', cursive" }}
          aria-hidden
        >
          <div className="text-4xl xl:text-5xl">Better</div>
          <div className="text-4xl xl:text-5xl">Water</div>
          <div className="text-4xl xl:text-5xl">Brighter</div>
          <div className="text-4xl xl:text-5xl">Lives</div>
        </div>
      </div>
    </section>
  );
}
