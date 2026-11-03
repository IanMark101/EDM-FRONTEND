import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backendRequest } from '@/app/lib/backend';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clinic workspace' };
export default async function ClinicPage() {
  const jar = await cookies();
  const response = await backendRequest(new Request('http://clinic.internal/api/session', { headers: { cookie: jar.toString() } }));
  if (!response.ok) throw new Error('The clinic service is unavailable. Start the backend and refresh.');
  const session = await response.json() as { user: unknown };
  if (!session.user) redirect('/login');
  return null;
}
