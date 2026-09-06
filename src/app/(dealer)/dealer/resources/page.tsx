import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { ContentPage } from '../_content';
import { SectionHero } from '@/components/SectionHero';

export const dynamic = 'force-dynamic';

export default function ResourcesPage() {
  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow="Resources"
        title="Resources & guides"
        subtitle="Product info, promotions, and how-tos — everything you need to sell and support."
        bgImage="/resources-hero.png"
      />
      <Link
        href="/dealer/resources/library"
        className="group flex items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-sky-600 text-white shadow-sm">
            <BookOpen size={28} />
          </div>
          <div>
            <div className="text-lg font-bold text-sky-900">Product library</div>
            <div className="text-sm text-sky-700">Product info, manuals, brochures and spec sheets — view or download.</div>
          </div>
        </div>
        <span className="flex-none text-2xl text-sky-500 transition group-hover:translate-x-1">→</span>
      </Link>
      <ContentPage slug="resources" hideHero />
    </div>
  );
}
