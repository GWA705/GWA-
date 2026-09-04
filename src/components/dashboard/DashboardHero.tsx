import { DashboardGreeting } from '@/components/DashboardGreeting';

/**
 * The dashboard hero banner — a refined, enterprise-style welcome. Blue gradient
 * (no external image — CSP-safe), a time-aware greeting by the user's name, the
 * office's portal name, and a light-line "house + growth arrow" brand graphic on
 * the right (decorative, hidden on small screens).
 */
export function DashboardHero({ firstName, companyName }: { firstName: string; companyName?: string | null }) {
  const portalName = companyName?.trim() ? `${companyName.trim()} Dealer Portal` : 'Dealer Portal';
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#07346e] text-white shadow-sm">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#04213f] via-[#0a3f82] to-[#0f68c9]" />
      <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-sky-300/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between gap-8 px-8 py-9 sm:px-12 sm:py-11">
        <div className="min-w-0">
          <DashboardGreeting firstName={firstName} className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300" />
          <h2 className="mt-3 text-3xl font-extrabold uppercase leading-[1.05] tracking-tight text-white sm:text-[2.75rem]">
            Welcome to your
            <br />
            <span className="bg-gradient-to-r from-white to-sky-200 bg-clip-text text-transparent">{portalName}</span>
          </h2>
          <p className="mt-4 max-w-xl text-base text-blue-100/90 sm:text-lg">
            Your hub for managing and organizing your business — all in one place.
          </p>
          <div className="mt-5 h-1 w-20 rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" />
        </div>

        {/* Brand graphic — house + rising growth arrow, line style */}
        <HeroGraphic />
      </div>
    </section>
  );
}

function HeroGraphic() {
  return (
    <svg
      viewBox="0 0 220 180"
      className="hidden h-40 w-52 flex-none text-sky-200/80 lg:block xl:h-44 xl:w-60"
      fill="none"
      aria-hidden
    >
      {/* soft swoosh */}
      <path d="M8 150 C 60 120, 150 168, 212 96" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
      {/* house */}
      <path d="M46 92 L104 50 L162 92" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 86 V140 H150 V86" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* window */}
      <rect x="88" y="102" width="32" height="30" rx="3" stroke="currentColor" strokeWidth="3.5" />
      <path d="M104 102 V132 M88 117 H120" stroke="currentColor" strokeWidth="3" />
      {/* rising growth arrow */}
      <path d="M150 78 L182 46 L214 60" stroke="#7dd3fc" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M214 60 L214 40 M214 60 L196 60" stroke="#7dd3fc" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
