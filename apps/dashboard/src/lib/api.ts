import { environment } from './environment';

export type Clinic = { id: string; name: string; slug: string; role: string };
export type Appointment = { id: string; startsAt: string; endsAt: string; status: string; patientDisplayName: string; serviceName: string };
export type DashboardOverview = {
  metrics: { todayScheduled: number; completed: number; inProgress: number; newPatientsThisMonth: number };
  todayAppointments: Appointment[];
  recentBookings: Appointment[];
  treatmentMix: Array<{ name: string; appointmentCount: number; percentage: number }>;
  location: { id: string; name: string; city?: string | null; region?: string | null; timezone: string } | null;
  subscription: { plan: string; status: string } | null;
};
type ApiError = { error?: { code?: string; message?: string } };

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${environment.apiUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as ApiError;
    throw new Error(payload.error?.message ?? 'DentivoHQ could not complete the request.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
