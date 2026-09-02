import type { DashboardOverview } from '../../lib/api';

export type DashboardUser = { name?: string | null; email: string };
export type DashboardPreview = {
  clinic: { id: string; name: string; slug: string; role: string };
  overview: DashboardOverview;
};

export const serviceColors = ['#6f9dff', '#55d5ca', '#ffbf54', '#ff795f', '#f3d275'];

export function initials(value: string) {
  return value.split(/\s+/).filter((part) => part && !/^(dr\.?|mr\.?|mrs\.?|ms\.?)$/i.test(part)).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'DH';
}

export function greetingName(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (/^dr\.?$/i.test(parts[0] ?? '') && parts.length > 1) return `Dr. ${parts.at(-1)}`;
  return parts[0] || 'there';
}

export function formatAppointmentTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export function formatAppointmentDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
