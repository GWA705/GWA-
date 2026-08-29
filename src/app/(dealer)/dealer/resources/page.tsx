import Link from 'next/link';
import { ContentPage } from '../_content';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default function ResourcesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        variant="hero"
        icon="📚"
        eyebrow="Resources"
        title="Resources & guides"
        subtitle="Product info, promotions, and how-tos — everything you need to sell and support."
      />
      <Link
        href="/dealer/resources/library"
        className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 transition hover:border-sky-300"
      >
        <div>
          <div className="font-semibold text-sky-900">Product manuals &amp; brochures</div>
          <div className="text-sm text-sky-700">Browse product info, manuals, brochures and spec sheets — view or download.</div>
        </div>
        <span className="text-xl text-sky-500">→</span>
      </Link>
      <ContentPage slug="resources" />
    </div>
  );
}
