import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { NoteTemplateForm } from './NoteTemplateForm';
import { NoteTemplateRow } from './NoteTemplateRow';

export const dynamic = 'force-dynamic';

export default async function NoteTemplatesPage() {
  await requireRole('ADMIN');
  const templates = await prisma.noteTemplate.findMany({
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Quick-note templates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Common messages reviewers can drop into a deal note with one click — for consistent,
          fast replies (e.g. &ldquo;Missing void cheque&rdquo;, &ldquo;Photo doesn&rsquo;t show the
          serial number&rdquo;). They appear as buttons above the note box on every deal.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Add a template</h2>
        <NoteTemplateForm />
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Templates {templates.length > 0 && <span className="text-sm font-normal text-gray-400">({templates.length})</span>}
        </h2>
        {templates.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">
            No templates yet. Add your first one above.
          </div>
        ) : (
          templates.map((t) => <NoteTemplateRow key={t.id} template={t} />)
        )}
      </div>
    </div>
  );
}
