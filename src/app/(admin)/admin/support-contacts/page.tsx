import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { SupportContactForm } from './SupportContactForm';
import { SupportContactRow } from './SupportContactRow';
import { createSupportContactAction } from '@/app/(admin)/actions';

export const dynamic = 'force-dynamic';

export default async function SupportContactsPage() {
  await requireAdminSection('support-contacts');
  const contacts = await prisma.supportContact.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Support contacts</h1>
        <p className="mt-1 text-sm text-gray-500">
          These cards show on the dealers’ <strong>Contact / Support</strong> page. Add GWA / Georgian
          Water &amp; Air lines and any other contacts you want dealers to have. Hide one to keep it
          without showing it.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Add a contact</h2>
        <SupportContactForm action={createSupportContactAction} />
      </div>

      {contacts.length > 0 && (
        <ul className="space-y-4">
          {contacts.map((c) => (
            <SupportContactRow key={c.id} contact={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
