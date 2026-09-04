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
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  tiles?: HeroTile[];
  flourish?: string[];
  bgImage?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl text-white shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#04213f] via-[#0a3f82] to-[#0f68c9]" aria-hidden />
      {bgImage && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${bgImage}')` }}
          aria-hidden
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#03152f] via-[#062a56]/85 to-[#062a56]/15" aria-hidden />

      <div className="relative z-10 flex items-center justify-between gap-6 px-6 py-7 sm:px-10 sm:py-8">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-sky-300">{eyebrow}</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-xl text-sm text-blue-100/90 sm:text-base">{subtitle}</p>}

          {tiles && tiles.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3">
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

        {flourish && flourish.length > 0 && (
          <div
            className="hidden flex-none pr-1 text-right leading-[1.12] text-sky-50/95 drop-shadow lg:block"
            style={{ fontFamily: "'Great Vibes', 'Segoe Script', cursive" }}
            aria-hidden
          >
            {flourish.map((l) => (
              <div key={l} className="text-3xl xl:text-4xl">{l}</div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
