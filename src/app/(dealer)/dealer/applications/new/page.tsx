import { requireRole } from '@/lib/session';
import { NewApplicationForm } from './NewApplicationForm';

export default async function NewApplicationPage() {
  await requireRole('DEALER_USER');
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New credit application</h1>
      <NewApplicationForm />
    </div>
  );
}
