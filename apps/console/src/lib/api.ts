import { environment } from './environment';

export async function getPlatformOverview() {
  const response = await fetch(`${environment.apiUrl}/api/v1/platform/overview`, { credentials: 'include' });
  const payload = await response.json() as { data?: { clinics: number; users: number; appointmentsToday: number }; error?: { message?: string } };
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? 'Unable to load the platform console.');
  return payload.data;
}
