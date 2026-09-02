import { Badge } from '@dentivohq/ui';
import type { Appointment } from '../../lib/api';
import { formatAppointmentDate, formatAppointmentTime, initials } from './dashboard-types';

export function TodayAppointmentRows({ appointments }: { appointments: Appointment[] }) {
  if (!appointments.length) return <p className="rounded-lg bg-muted px-3 py-5 text-center text-xs text-muted-foreground">No appointments scheduled for today.</p>;
  return <div>{appointments.map((appointment) => <div className="grid grid-cols-[52px_30px_1fr_auto] items-center gap-2.5 border-t border-[#edf1f6] py-2.5 first:border-t-0" key={appointment.id}><span className="text-[11px] text-[#53627d]">{formatAppointmentTime(appointment.startsAt)}</span><span className="grid size-[30px] place-items-center rounded-full bg-[#d9e6f6] text-[10px] font-extrabold">{initials(appointment.patientDisplayName)}</span><span className="min-w-0"><strong className="block truncate text-[11px]">{appointment.patientDisplayName}</strong><small className="mt-0.5 block truncate text-[10px] text-muted-foreground">{appointment.serviceName}</small></span><StatusBadge status={appointment.status} /></div>)}</div>;
}

export function BookingRows({ appointments }: { appointments: Appointment[] }) {
  if (!appointments.length) return <p className="rounded-lg bg-muted px-3 py-5 text-center text-xs text-muted-foreground">New bookings will appear here.</p>;
  return <div>{appointments.map((appointment) => <div className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 border-t border-[#edf1f6] py-2.5 first:border-t-0" key={appointment.id}><span className="grid size-[30px] place-items-center rounded-full bg-[#d9e6f6] text-[10px] font-extrabold">{initials(appointment.patientDisplayName)}</span><span className="min-w-0"><strong className="block truncate text-[11px]">{appointment.patientDisplayName}</strong><small className="mt-0.5 block truncate text-[9px] text-muted-foreground">{formatAppointmentDate(appointment.startsAt)}</small></span><StatusBadge status={appointment.status} /></div>)}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'IN_PROGRESS' || status === 'CHECKED_IN';
  return <Badge className={active ? 'hidden rounded-md bg-[#eaf9f3] px-2 py-1 text-[9px] text-[#14a66f] sm:inline-flex' : 'hidden rounded-md bg-secondary px-2 py-1 text-[9px] text-primary sm:inline-flex'}>{status.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</Badge>;
}
