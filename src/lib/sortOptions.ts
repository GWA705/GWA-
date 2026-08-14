// Plain (server-safe) sort-option lists shared by the list pages AND their
// client control components. These MUST live outside any 'use client' module:
// exports from a client module become client references, so a Server Component
// calling e.g. `.some()` on them throws "call some() from the server but some
// is on the client".

export const DEALER_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_high', label: 'Amount: high → low' },
  { value: 'amount_low', label: 'Amount: low → high' },
  { value: 'name', label: 'Name: A → Z' },
  { value: 'status', label: 'Status' },
] as const;

export const QUEUE_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_high', label: 'Amount: high → low' },
  { value: 'amount_low', label: 'Amount: low → high' },
  { value: 'name', label: 'Name: A → Z' },
  { value: 'status', label: 'Status' },
] as const;
