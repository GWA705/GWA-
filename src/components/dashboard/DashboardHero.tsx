import { Droplets, Wind, Home, Users } from 'lucide-react';
import { DashboardGreeting } from '@/components/DashboardGreeting';

const CHIPS = [
  { Icon: Droplets, text: 'BETTER WATER' },
  { Icon: Wind, text: 'CLEANER AIR' },
  { Icon: Home, text: 'HEALTHIER HOMES' },
  { Icon: Users, text: 'STRONGER TOGETHER' },
];

/**
 * The dashboard hero banner. Blue gradient (no external image — CSP-safe), a
 * time-aware greeting by the user's name, and the office's portal name.
 */
export function DashboardHero({ firstName, companyName }: { firstName: string; companyName?: string | null }) {
  const portalName = companyName?.trim() ? `${companyName.trim()} Portal` : 'Dealer Portal';
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[#07346e] px-8 py-8 text-white sm:px-12">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#04234c] via-[#07346e] to-[#0b57a8]" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-sky-400/10 blur-2xl" />
      <Droplets size={260} className="pointer-events-none absolute -bottom-16 right-4 text-white/5" />

      <div className="relative z-10">
        <DashboardGreeting firstName={firstName} className="text-4xl font-extrabold tracking-tight sm:text-5xl" />
        <p className="mt-2 text-xl font-semibold text-blue-50">Welcome to your {portalName}</p>
        <p className="mt-2 max-w-xl text-blue-100">
          Everything you need to manage, process and grow your business — all in one place.
        </p>
        <div className="mt-4 h-1 w-16 rounded-full bg-sky-400" />
        <div className="mt-5 flex flex-wrap gap-6 text-[11px] font-bold tracking-wider">
          {CHIPS.map((c) => (
            <div key={c.text} className="flex items-center gap-2">
              <c.Icon size={18} className="text-sky-300" />
              <span>{c.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
