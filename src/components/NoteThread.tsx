import type { Note } from '@prisma/client';

type NoteWithAuthor = Note & { author?: { name: string } };

export function NoteThread({ notes, emptyText }: { notes: NoteWithAuthor[]; emptyText?: string }) {
  if (notes.length === 0) {
    return <p className="text-sm text-gray-500">{emptyText ?? 'No notes yet.'}</p>;
  }
  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="rounded-md bg-gray-50 p-3">
          <p className="whitespace-pre-wrap text-sm text-gray-800">{n.body}</p>
          <p className="mt-1 text-xs text-gray-400">
            {n.author?.name ?? 'Unknown'} · {n.createdAt.toLocaleString('en-CA')}
          </p>
        </li>
      ))}
    </ul>
  );
}
