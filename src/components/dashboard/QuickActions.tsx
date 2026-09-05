import Link from 'next/link';
import { UserPlus, BookOpen, Users, ShoppingCart, Zap } from 'lucide-react';

const ITEMS = [
  { href: '/dealer/applications/new', title: 'New Customer', subtitle: 'Add a new customer', tone: 'dark' as const, Icon: UserPlus },
  { href: '/dealer/resources/library', title: 'Product Resources', subtitle: 'Guides & product library', tone: 'blue' as const, Icon: BookOpen },
  { href: '/dealer/leads', title: 'Find a Lead', subtitle: 'View available leads', tone: 'soft' as const, Icon: Users },
  { href: '/dealer/marketplace', title: 'Visit Marketplace', subtitle: 'Products & resources', tone: 'soft' as const, Icon: ShoppingCart },
];

const TONE: Record<'dark' | 'blue' | 'soft', string> = {
  dark: 'bg-[#073d8c] text-white',
  blue: 'bg-blue-600 text-white',
  soft: 'bg-[#f4f8fd] text-blue-700 border border-blue-100',
};

/** The right-rail Quick Actions grid. Links to the real routes. */
export function QuickActions() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Zap size={22} className="text-blue-600" />
        <h3 className="text-xl font-bold text-[#0d2a63] dark:text-slate-100">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((a) => (
          <Link
            key={a.title}
            href={a.href}
            className={`flex min-h-[105px] flex-col items-center justify-center rounded-xl p-4 text-center transition hover:opacity-95 ${TONE[a.tone]}`}
          >
            <a.Icon size={26} />
            <div className="mt-2 text-sm font-bold">{a.title}</div>
            <div className={`mt-1 text-[11px] ${a.tone === 'soft' ? 'text-gray-500' : 'text-blue-100'}`}>{a.subtitle}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
