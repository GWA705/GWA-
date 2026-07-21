import { redirect } from 'next/navigation';
import { getSession, defaultLandingFor } from '@/lib/session';

export default async function Home() {
  const session = await getSession();
  redirect(session ? defaultLandingFor(session.role) : '/login');
}
