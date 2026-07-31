import Link from 'next/link';

/**
 * Simple GET search form. Submits `q` to the given action path. Shows a clear
 * link when a search is active.
 */
export function SearchBox({
  action,
  q,
  placeholder = 'Search name or reference #…',
}: {
  action: string;
  q?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} method="get" className="flex w-full items-center gap-2 sm:w-auto">
      <input
        type="search"
        name="q"
        defaultValue={q ?? ''}
        placeholder={placeholder}
        className="input h-9 w-full min-w-0 py-1 sm:w-64"
        aria-label="Search"
      />
      <button type="submit" className="btn-secondary h-9 py-1 text-sm">Search</button>
      {q && (
        <Link href={action} className="text-sm text-gray-500 hover:underline">
          Clear
        </Link>
      )}
    </form>
  );
}
