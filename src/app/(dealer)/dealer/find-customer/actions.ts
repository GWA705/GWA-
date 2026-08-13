'use server';

import { getSession } from '@/lib/session';
import { searchCustomers, type CustomerSearchResult } from '@/lib/customerSearch';

// Shared by the dealer and staff Find-customer pages. Branches by the caller's
// role inside searchCustomers; enforces the master toggle, rate limit and audit.
export async function customerSearchAction(query: string): Promise<CustomerSearchResult> {
  const user = await getSession();
  if (!user) return { status: 'disabled' };
  return searchCustomers(user, query);
}
