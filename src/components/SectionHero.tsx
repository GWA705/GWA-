import type { LucideIcon } from 'lucide-react';

export interface HeroTile {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
}

/**
 * Shared enterprise-style page hero for the dealer tabs (Marketplace,
 * Resources, Gift cards, Leads, …). Blue gradient with an optional swappable
 * background photo, an eyebrow + title + subtitle, an optional row of feature
 * tiles, and an optional hand-script flourish on the right (Great Vibes web
 * font, loaded in the root layout; degrades to cursive). One look, many tabs.
 */
export function SectionHero({
  eyebrow,
  title,
  subtitle,
  tiles,
  flourish,
  bgImage,
  bgPosition = 'center right',
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  tiles?: HeroTile[];
  flourish?: string[];
  bgImage?: string;
  /** Which part of the photo to keep in frame (CSS background-position). The
      photo is scaled to cover (never distorted) and cropped to this focus. */
  bgPosition?: string;
  /** Right-side action(s), e.g. a primary button. Shown instead of the flourish. */
  actions?: React.ReactNode;
}) {
  return (
    <section className="relative min-h-[188px] overflow-hidden rounded-2xl text-white shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#04213f] via-[#0a3f82] to-[#0f68c9]" aria-hidden />
      {bgImage && (
        // Photo scaled to cover (proportional, no distortion), focused per page,
        // and feathered on the left so it blends into the gradient with no seam.
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: `url('${bgImage}')`,
            backgroundPosition: bgPosition,
            maskImage: 'linear-gradient(to right, transparent 0%, #000 40%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 40%)',
          }}
          aria-hidden
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#03152f] via-[#062a56]/80 to-[#062a56]/10" aria-hidden />
      {/* Extra scrim on phones: the photo fills the whole width there, so darken
          it so the eyebrow/title/subtitle stay legible over it. */}
      <div className="pointer-events-none absolute inset-0 bg-[#04213f]/55 sm:hidden" aria-hidden />

      <div className="relative z-10 flex items-center justify-between gap-6 px-6 py-7 sm:px-10 sm:py-8">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{eyebrow}</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-xl text-sm text-blue-100/90 sm:text-base">{subtitle}</p>}

          {tiles && tiles.length > 0 && (
            // Hidden on phones — they duplicate the category cards below and make
            // the hero very tall on a small screen.
            <div className="mt-5 hidden flex-wrap gap-x-7 gap-y-3 sm:flex">
              {tiles.map((t) => (
                <div key={t.title} className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/10">
                    <t.Icon size={18} className="text-sky-200" />
                  </span>
                  <div className="leading-tight">
                    <div className="text-[11px] font-bold uppercase tracking-wide">{t.title}</div>
                    {t.subtitle && <div className="text-[11px] text-blue-100/80">{t.subtitle}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {actions ? (
          <div className="hidden flex-none sm:block">{actions}</div>
        ) : (
          flourish && flourish.length > 0 && (
            <div
              className="hidden flex-none pr-1 text-right leading-[1.12] text-sky-50/95 drop-shadow lg:block"
              style={{ fontFamily: "'Great Vibes', 'Segoe Script', cursive" }}
              aria-hidden
            >
              {flourish.map((l) => (
                <div key={l} className="text-3xl xl:text-4xl">{l}</div>
              ))}
            </div>
          )
        )}
      </div>
    </section>
  );
}
