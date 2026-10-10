import { prisma } from '@/lib/db';
import { bookingRequestLabel } from '@/lib/leadBooking';
import { BookingForm } from './BookingForm';

export const dynamic = 'force-dynamic';

function firstNameOf(name: string | null): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-5 text-center">
        <div className="text-base font-semibold text-gray-900">Home Depot Home Services</div>
        <div className="text-xs text-gray-500">serviced by Georgian Water &amp; Air</div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
      <p className="mt-4 text-center text-[11px] text-gray-400">
        Booking your free in-home water assessment. If you didn’t request this, you can ignore this page.
      </p>
    </main>
  );
}

export default async function BookingPage({ params }: { params: { token: string } }) {
  const lead = await prisma.scannedLead.findUnique({
    where: { bookingToken: params.token },
    select: {
      id: true, customerName: true, status: true, bookingStatus: true,
      bookingRequestedAt: true, bookingCallNow: true, bookingPreferredDay: true, bookingWindow: true,
    },
  });

  // Invalid / unknown token — don't reveal anything.
  if (!lead) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold text-gray-900">This link isn’t valid</h1>
        <p className="mt-2 text-sm text-gray-600">
          This booking link has expired or isn’t recognized. If you’re expecting a call about a water assessment,
          no action is needed — a team member will be in touch.
        </p>
      </Shell>
    );
  }

  // Already handled by a booker — reassure, don't re-collect.
  const worked = lead.status !== 'NEW' || !!lead.bookingStatus;
  if (worked) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-2xl">👍</div>
          <h1 className="mt-2 text-lg font-semibold text-gray-900">You’re all set</h1>
          <p className="mt-2 text-sm text-gray-600">
            Our team is already taking care of your in-home water assessment. If you need anything, we’ll be in touch —
            no action needed here.
          </p>
        </div>
      </Shell>
    );
  }

  const firstName = firstNameOf(lead.customerName);
  const alreadyRequested = !!lead.bookingRequestedAt;

  return (
    <Shell>
      <h1 className="text-lg font-semibold text-gray-900">
        {firstName ? `Hi ${firstName} —` : 'Hi —'} let’s find a time
      </h1>
      <p className="mt-1 mb-4 text-sm text-gray-600">
        Pick a day and time that suits you for your <strong>free in-home water assessment</strong>, and a team member
        will call to confirm. Prefer to talk now? Choose “call me as soon as possible.”
      </p>

      {alreadyRequested && (
        <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          We already have your request{lead.bookingCallNow ? ' to be called as soon as possible' : ` for ${bookingRequestLabel(lead.bookingPreferredDay, lead.bookingWindow)}`}.
          You can update it below if something changed.
        </div>
      )}

      <BookingForm token={params.token} firstName={firstName} />
    </Shell>
  );
}
