import type { Note } from '@prisma/client';
import { REVIEWER_DISPLAY, isInternalRole } from '@/lib/constants';

type NoteWithAuthor = Note & { author?: { name: string; role?: string | null } | null };

export function NoteThread({
  notes,
  emptyText,
  anonymizeStaff = false,
}: {
  notes: NoteWithAuthor[];
  emptyText?: string;
  // When true (dealer-facing), GWA staff authors show as "Reviewer" instead of
  // their name. The dealer's own users keep their names.
  anonymizeStaff?: boolean;
}) {
  if (notes.length === 0) {
    return <p className="text-sm text-gray-500">{emptyText ?? 'No notes yet.'}</p>;
  }
  return (
    <ul className="space-y-3">
      {notes.map((n) => {
        const authorName =
          anonymizeStaff && isInternalRole(n.author?.role) ? REVIEWER_DISPLAY : n.author?.name ?? 'Unknown';
        return (
          <li key={n.id} className="rounded-md bg-gray-50 p-3">
            <p className="whitespace-pre-wrap text-sm text-gray-800">{n.body}</p>
            <p className="mt-1 text-xs text-gray-400">
              {authorName} · {n.createdAt.toLocaleString('en-CA')}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
